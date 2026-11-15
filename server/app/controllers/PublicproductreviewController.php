<?php
/**
 * Public product reviews. Reviews are saved as Pending and show on the website only after staff approve them.
 * POST /api/publicproductreview/create
 * GET  /api/publicproductreview/product/{partId}   approved reviews only, safe public fields
 */
class PublicproductreviewController extends Controller {
    private $apiClientModel;
    private $db;

    public function __construct() {
        $this->apiClientModel = $this->model('ApiClient');
        $this->db = new Database();
    }

    /** The name typed on the review form (a shopper's customer record may carry another name). */
    private function ensureReviewerNameColumn() {
        static $done = false;
        if ($done) return;
        $done = true;
        try {
            $this->db->query("ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(120) NULL AFTER customer_id");
            $this->db->execute();
        } catch (Exception $e) {}
    }

    /** "Thilina Ruwan" -> "Thilina R." so full names and emails are never published. */
    private function publicName($name) {
        $parts = preg_split('/\s+/', trim((string)$name));
        $first = $parts[0] ?? '';
        if ($first === '') return 'Tea Jar customer';
        $last = count($parts) > 1 ? mb_substr(end($parts), 0, 1) . '.' : '';
        return trim($first . ' ' . mb_strtoupper($last));
    }

    public function product($partId = null) {
        $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        if (empty($key) || !$this->apiClientModel->validate($key, $_SERVER['HTTP_ORIGIN'] ?? '')) {
            $this->error('Unauthorized', 403);
        }
        $partId = (int)$partId;
        if ($partId <= 0) $this->error('Product ID required', 400);
        $this->ensureReviewerNameColumn();

        $this->db->query("SELECT pr.id, pr.rating, pr.comment, pr.admin_reply, pr.replied_at, pr.created_at, COALESCE(NULLIF(pr.reviewer_name, ''), c.name) AS customer_name
                          FROM product_reviews pr
                          JOIN customers c ON pr.customer_id = c.id
                          WHERE pr.part_id = :pid AND pr.status = 'Approved'
                          ORDER BY pr.created_at DESC
                          LIMIT 100");
        $this->db->bind(':pid', $partId);
        $rows = $this->db->resultSet();

        $reviews = [];
        $sum = 0;
        $breakdown = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
        foreach ($rows as $r) {
            $rating = max(1, min(5, (int)$r->rating));
            $sum += $rating;
            $breakdown[$rating]++;
            // Website reviews are saved as "Title\n\nBody"; split the title back out when it looks like one.
            $comment = (string)$r->comment;
            $title = '';
            $body = $comment;
            $split = preg_split("/\r?\n\r?\n/", $comment, 2);
            if (count($split) === 2 && mb_strlen($split[0]) <= 120 && strpos($split[0], "\n") === false) {
                $title = $split[0];
                $body = $split[1];
            }
            $reviews[] = [
                'id' => (int)$r->id,
                'rating' => $rating,
                'title' => $title,
                'body' => $body,
                'author' => $this->publicName($r->customer_name),
                'created_at' => (string)$r->created_at,
                'reply' => $r->admin_reply ? (string)$r->admin_reply : null,
                'replied_at' => $r->replied_at ? (string)$r->replied_at : null,
            ];
        }
        $count = count($reviews);
        $this->success([
            'count' => $count,
            'average' => $count ? round($sum / $count, 1) : 0,
            'breakdown' => $breakdown,
            'reviews' => $reviews,
        ]);
    }

    public function create() {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);

        $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        if (empty($key) || !$this->apiClientModel->validate($key, $_SERVER['HTTP_ORIGIN'] ?? '')) {
            $this->error('Unauthorized', 403);
        }

        require_once '../app/helpers/PublicFormGuard.php';
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) $this->error('Invalid input', 400);

        if (PublicFormGuard::spamVerdict($data)) {
            $this->success(['received' => true], 'Thank you. Your review will appear after it has been checked.');
        }
        PublicFormGuard::rateLimit($this, 'review', 3, 60);

        $partId = (int)($data['productId'] ?? 0);
        $rating = (int)($data['rating'] ?? 0);
        $name = PublicFormGuard::text($data['name'] ?? '', 120);
        $email = strtolower(PublicFormGuard::text($data['email'] ?? '', 160));
        $title = PublicFormGuard::text($data['title'] ?? '', 120);
        $body = trim((string)($data['body'] ?? ''));

        if ($partId <= 0) $this->error('This product is not available for reviews.', 400);
        if ($rating < 1 || $rating > 5) $this->error('Please choose a rating from 1 to 5 stars.', 400);
        if (mb_strlen($name) < 2) $this->error('Please enter your name.', 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $this->error('Please enter a valid email address.', 400);
        if (mb_strlen($body) < 10) $this->error('Your review needs at least 10 characters.', 400);
        if (mb_strlen($body) > 1500) $this->error('Your review can be at most 1500 characters.', 400);
        if (PublicFormGuard::hasLink($body) || PublicFormGuard::hasLink($title) || PublicFormGuard::hasLink($name)) {
            $this->error('Links are not allowed in reviews.', 400);
        }

        // The product must be one the website sells online.
        $this->db->query("SELECT id FROM parts WHERE id = :id AND is_active = 1 AND is_online = 1 LIMIT 1");
        $this->db->bind(':id', $partId);
        if (!$this->db->single()) $this->error('This product is not available for reviews.', 400);

        // Signed-in reviews follow the account even if there are older guest records for its email.
        require_once '../app/helpers/CustomerAuth.php';
        $accountId = CustomerAuth::customerIdFromRequest();
        $existing = null;
        if ($accountId) {
            $this->db->query("SELECT id FROM customers WHERE id = :id AND is_active = 1 AND is_ecommerce_user = 1");
            $this->db->bind(':id', $accountId);
            $existing = $this->db->single();
        }
        if (!$existing) {
            $this->db->query("SELECT id FROM customers WHERE email = :email LIMIT 1");
            $this->db->bind(':email', $email);
            $existing = $this->db->single();
        }
        if ($existing) {
            $customerId = (int)$existing->id;
        } else {
            $customerId = (int)$this->model('Customer')->create([
                'name' => $name,
                'email' => $email,
                'phone' => null,
                'order_type' => 'External',
                'is_active' => 1,
            ]);
            if ($customerId <= 0) $this->error('Could not save your review. Please try again.', 500);
        }

        $comment = $title !== '' ? $title . "\n\n" . $body : $body;
        $reviewId = $this->model('ProductReview')->add([
            'part_id' => $partId,
            'customer_id' => $customerId,
            'rating' => $rating,
            'comment' => $comment,
            'status' => 'Pending',
        ]);
        if (!$reviewId) $this->error('Could not save your review. Please try again.', 500);
        $this->ensureReviewerNameColumn();
        $this->db->query("UPDATE product_reviews SET reviewer_name = :name WHERE id = :id");
        $this->db->bind(':name', $name);
        $this->db->bind(':id', (int)$reviewId);
        $this->db->execute();
        PublicFormGuard::record('review');

        $this->success(['id' => $reviewId], 'Thank you. Your review will appear after it has been checked.');
    }
}
