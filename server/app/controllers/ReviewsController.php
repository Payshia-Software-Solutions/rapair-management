<?php
/**
 * ReviewsController
 * Managing product reviews and image uploads.
 */
class ReviewsController extends Controller {
    private $reviewModel;

    public function __construct() {
        $this->reviewModel = $this->model('ProductReview');
        require_once '../app/helpers/ReviewSchema.php';
        ReviewSchema::ensure();
    }

    // GET /api/reviews
    public function index() {
        $this->requirePermission('reviews.manage');
        $status = $_GET['status'] ?? null;
        $reviews = $this->reviewModel->getAll($status);
        
        // Add image paths to reviews
        foreach ($reviews as &$review) {
            $review->images = $this->reviewModel->getReviewImages($review->id);
        }
        
        $this->success($reviews);
    }

    // GET /api/reviews/product/1
    public function product($partId = null) {
        if (!$partId) $this->error('Product ID required', 400);
        $onlyApproved = !(isset($_GET['all']) && $_GET['all'] == '1');
        $reviews = $this->reviewModel->getByProduct($partId, $onlyApproved);
        $this->success($reviews);
    }

    // POST /api/reviews/submit
    public function submit() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        
        // Handled as multipart/form-data
        $partId = $_POST['part_id'] ?? null;
        $customerId = $_POST['customer_id'] ?? null;
        $rating = $_POST['rating'] ?? null;
        $comment = $_POST['comment'] ?? '';

        if (!$partId || !$customerId || !$rating) {
            $this->error('Missing required fields (part_id, customer_id, rating)', 400);
        }

        $reviewData = [
            'part_id' => $partId,
            'customer_id' => $customerId,
            'rating' => $rating,
            'comment' => $comment,
            'status' => 'Pending'
        ];

        $reviewId = $this->reviewModel->add($reviewData);
        if (!$reviewId) {
            $this->error('Failed to submit review');
        }

        // Handle Image Uploads
        if (!empty($_FILES['images'])) {
            $this->handleImageUploads($reviewId, $_FILES['images']);
        }

        $this->success(['id' => $reviewId], 'Review submitted for approval');
    }

    private function handleImageUploads($reviewId, $files) {
        require_once __DIR__ . '/../helpers/ContentStore.php';

        $normalizedFiles = [];
        if (is_array($files['name'])) {
            for ($i = 0; $i < count($files['name']); $i++) {
                if ($files['error'][$i] === UPLOAD_ERR_OK) {
                    $normalizedFiles[] = [
                        'name' => $files['name'][$i],
                        'tmp_name' => $files['tmp_name'][$i]
                    ];
                }
            }
        } else {
            if ($files['error'] === UPLOAD_ERR_OK) {
                $normalizedFiles[] = $files;
            }
        }

        // Images only, judged by the file's real content (not its name), up to 5 MB, at most 5 per review.
        // The saved extension comes from that check, so a script can never be stored under public/uploads.
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $saved = 0;
        foreach ($normalizedFiles as $file) {
            if ($saved >= 5) break;
            if (!is_uploaded_file($file['tmp_name']) || filesize($file['tmp_name']) > 5 * 1024 * 1024) continue;
            $mime = $finfo->file($file['tmp_name']) ?: '';
            if (!isset($allowed[$mime]) || @getimagesize($file['tmp_name']) === false) continue;
            $ext = $allowed[$mime];
            $filename = 'review_' . (int)$reviewId . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
            $saved++;
            try {
                $this->reviewModel->addImage($reviewId, ContentStore::save($file['tmp_name'], 'reviews', $filename));
            } catch (Throwable $e) {
                error_log('Review image: ' . $e->getMessage());
            }
        }
    }

    // POST /api/reviews/approve/1
    public function approve($id = null) {
        $this->requirePermission('reviews.manage');
        if (!$id) $this->error('ID required', 400);
        if ($this->reviewModel->updateStatus($id, 'Approved')) {
            $this->success(null, 'Review approved');
        }
        $this->error('Failed to approve review');
    }

    // POST /api/reviews/reject/1
    public function reject($id = null) {
        $this->requirePermission('reviews.manage');
        if (!$id) $this->error('ID required', 400);
        if ($this->reviewModel->updateStatus($id, 'Rejected')) {
            $this->success(null, 'Review rejected');
        }
        $this->error('Failed to reject review');
    }

    // POST /api/reviews/reply/1
    public function reply($id = null) {
        $this->requirePermission('reviews.manage');
        if (!$id) $this->error('ID required', 400);
        
        $json = json_decode(file_get_contents('php://input'), true);
        $reply = $json['reply'] ?? null;
        
        if (!$reply) $this->error('Reply text required', 400);
        
        if ($this->reviewModel->updateReply($id, $reply)) {
            $this->success(null, 'Reply saved');
        }
        $this->error('Failed to save reply');
    }

    // GET /api/reviews/customer/1
    public function customer($customerId = null) {
        if (!$customerId) $this->error('Customer ID required', 400);
        
        $reviews = $this->reviewModel->getByCustomer($customerId);
        
        // Add image paths and product names
        foreach ($reviews as &$review) {
            $review->images = $this->reviewModel->getReviewImages($review->id);
            // Get product name
            $db = new Database();
            $db->query("SELECT name FROM parts WHERE id = :id");
            $db->bind(':id', $review->part_id);
            $product = $db->single();
            $review->product_name = $product ? $product->name : 'Unknown Product';
        }
        
        $this->success($reviews);
    }

    // DELETE /api/reviews/delete/1
    public function delete($id = null) {
        $this->requirePermission('reviews.manage');
        if (!$id) $this->error('ID required', 400);
        if ($this->reviewModel->delete($id)) {
            $this->success(null, 'Review deleted');
        }
        $this->error('Failed to delete review');
    }
}
