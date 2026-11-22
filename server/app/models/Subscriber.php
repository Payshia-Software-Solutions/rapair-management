<?php
class Subscriber {
    private $db;

    public function __construct() {
        require_once '../app/helpers/SubscriberSchema.php';
        SubscriberSchema::ensure();
        $this->db = new Database();
    }

    public function getAll($status = null, $search = null) {
        $sql = "SELECT s.*, c.name AS customer_name
                FROM newsletter_subscribers s
                LEFT JOIN customers c ON c.id = s.customer_id
                WHERE 1=1";
        if ($status) $sql .= " AND s.status = :status";
        if ($search) $sql .= " AND (s.email LIKE :q1 OR s.name LIKE :q2)";
        $sql .= " ORDER BY s.created_at DESC";
        $this->db->query($sql);
        if ($status) $this->db->bind(':status', $status);
        if ($search) {
            $this->db->bind(':q1', '%' . $search . '%');
            $this->db->bind(':q2', '%' . $search . '%');
        }
        return $this->db->resultSet();
    }

    public function stats() {
        $this->db->query("SELECT
                COUNT(*) AS total,
                SUM(status = 'Subscribed') AS subscribed,
                SUM(status = 'Unsubscribed') AS unsubscribed,
                SUM(status = 'Subscribed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS last_30_days
            FROM newsletter_subscribers");
        return $this->db->single();
    }

    public function findByEmail($email) {
        $this->db->query("SELECT * FROM newsletter_subscribers WHERE email = :e");
        $this->db->bind(':e', $email);
        return $this->db->single();
    }

    public function findByToken($token) {
        $this->db->query("SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = :t");
        $this->db->bind(':t', $token);
        return $this->db->single();
    }

    /** Adds a subscriber, or re-subscribes an existing email. Returns [id, wasAlreadySubscribed]. */
    public function subscribe($email, $name = null, $source = 'Website', $locationId = null, $ip = null) {
        $email = strtolower(trim($email));
        $existing = $this->findByEmail($email);

        // Link to a customer account with the same email, if there is one.
        $this->db->query("SELECT id FROM customers WHERE LOWER(email) = :e ORDER BY is_ecommerce_user DESC, id ASC LIMIT 1");
        $this->db->bind(':e', $email);
        $customer = $this->db->single();
        $customerId = $customer ? (int)$customer->id : null;

        if ($existing) {
            $already = $existing->status === 'Subscribed';
            $this->db->query("UPDATE newsletter_subscribers
                SET status = 'Subscribed',
                    name = COALESCE(:name, name),
                    customer_id = COALESCE(:cid, customer_id),
                    location_id = COALESCE(location_id, :loc),
                    subscribed_at = IF(status = 'Subscribed', subscribed_at, NOW()),
                    unsubscribed_at = NULL
                WHERE id = :id");
            $this->db->bind(':name', $name ?: null);
            $this->db->bind(':cid', $customerId);
            $this->db->bind(':loc', $locationId ?: null);
            $this->db->bind(':id', $existing->id);
            $this->db->execute();
            return [(int)$existing->id, $already];
        }

        $this->db->query("INSERT INTO newsletter_subscribers
            (email, name, source, status, location_id, customer_id, unsubscribe_token, ip_address)
            VALUES (:email, :name, :source, 'Subscribed', :loc, :cid, :token, :ip)");
        $this->db->bind(':email', $email);
        $this->db->bind(':name', $name ?: null);
        $this->db->bind(':source', $source);
        $this->db->bind(':loc', $locationId ?: null);
        $this->db->bind(':cid', $customerId);
        $this->db->bind(':token', bin2hex(random_bytes(20)));
        $this->db->bind(':ip', $ip);
        $this->db->execute();
        return [(int)$this->db->lastInsertId(), false];
    }

    public function setStatus($id, $status) {
        $this->db->query("UPDATE newsletter_subscribers
            SET status = :s,
                unsubscribed_at = IF(:s2 = 'Unsubscribed', NOW(), NULL),
                subscribed_at = IF(:s3 = 'Subscribed' AND status = 'Unsubscribed', NOW(), subscribed_at)
            WHERE id = :id");
        $this->db->bind(':s', $status);
        $this->db->bind(':s2', $status);
        $this->db->bind(':s3', $status);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM newsletter_subscribers WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
