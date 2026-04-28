<?php
class EmailMarketingController extends Controller {

    public function __construct() {
        require_once __DIR__ . '/../helpers/EmailHelper.php';
        require_once __DIR__ . '/../models/Customer.php';
    }

    /**
     * GET /api/email-marketing/campaigns
     */
    public function campaigns() {
        $db = new Database();
        $db->query("SELECT * FROM email_campaigns ORDER BY id DESC LIMIT 50");
        $data = $db->resultSet();
        $this->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * GET /api/email-marketing/templates
     */
    public function templates() {
        $db = new Database();
        $db->query("SELECT * FROM email_templates ORDER BY id DESC");
        $data = $db->resultSet();
        $this->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * POST /api/email-marketing/save-template
     */
    public function save_template() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $id = $data['id'] ?? null;
        $name = $data['name'] ?? null;
        $subject = $data['subject'] ?? null;
        $content = $data['content'] ?? null;

        if (!$name || !$content) {
            $this->json(['status' => 'error', 'message' => 'Name and content are required.'], 422);
            return;
        }

        $db = new Database();
        if ($id) {
            $db->query("UPDATE email_templates SET name = :name, subject = :sub, content = :content WHERE id = :id");
            $db->bind(':id', $id);
        } else {
            $db->query("INSERT INTO email_templates (name, subject, content) VALUES (:name, :sub, :content)");
        }
        
        $db->bind(':name', $name);
        $db->bind(':sub', $subject);
        $db->bind(':content', $content);
        $db->execute();

        $this->json(['status' => 'success', 'message' => 'Template saved.']);
    }

    /**
     * POST /api/email-marketing/send-campaign
     */
    public function send_campaign() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = $data['name'] ?? 'Newsletter ' . date('Y-m-d H:i');
        $subject = $data['subject'] ?? null;
        $content = $data['content'] ?? null;
        $segment = $data['segment'] ?? 'all';

        if (!$subject || !$content) {
            $this->json(['status' => 'error', 'message' => 'Subject and content are required.'], 422);
            return;
        }

        // 1. Create Campaign Record
        $db = new Database();
        $db->query("INSERT INTO email_campaigns (name, subject, content, target_segment, status) VALUES (:name, :sub, :content, :seg, 'Queued')");
        $db->bind(':name', $name);
        $db->bind(':sub', $subject);
        $db->bind(':content', $content);
        $db->bind(':seg', $segment);
        $db->execute();
        $campaignId = $db->lastInsertId();

        // 2. Fetch Recipients (Exclude Unsubscribed)
        if ($segment === 'all') {
            $db->query("SELECT name, email, id FROM customers WHERE email IS NOT NULL AND email != '' AND is_unsubscribed = 0");
            $recipients = $db->resultSet();
        } else if (is_numeric($segment)) {
            $db->query("SELECT name, email, id FROM segment_contacts WHERE segment_id = :sid AND email IS NOT NULL AND email != ''");
            $db->bind(':sid', $segment);
            $recipients = $db->resultSet();
        }

        // 3. Queue them
        foreach ($recipients as $r) {
            $db->query("INSERT INTO email_queue (campaign_id, customer_id, recipient_email, recipient_name, subject, content) VALUES (:cam, :cid, :email, :name, :sub, :content)");
            $db->bind(':cam', $campaignId);
            $db->bind(':cid', $r->id ?? null);
            $db->bind(':email', $r->email);
            $db->bind(':name', $r->name);
            $db->bind(':sub', $subject);
            $db->bind(':content', $content);
            $db->execute();
        }

        $this->json([
            'status' => 'success', 
            'message' => "Campaign queued for " . count($recipients) . " recipients. Sending will start shortly."
        ]);
    }

    /**
     * POST /api/email-marketing/process-queue
     * Processes a batch of emails from the queue.
     */
    public function process_queue() {
        $db = new Database();
        $batchSize = 25; // Send 25 at a time to prevent spam detection

        // Get pending emails
        $db->query("SELECT * FROM email_queue WHERE status = 'Pending' LIMIT :limit");
        $db->bind(':limit', $batchSize);
        $queue = $db->resultSet();

        if (empty($queue)) {
            // Run cleanup even if queue is empty to sync any missed statuses
            $this->sync_campaign_statuses();
            $this->json(['status' => 'success', 'message' => 'Queue is empty. Statuses synced.', 'processed' => 0]);
            return;
        }

        $processed = 0;
        foreach ($queue as $item) {
            // Mark as processing
            $db->query("UPDATE email_queue SET status = 'Processing' WHERE id = :id");
            $db->bind(':id', $item->id);
            $db->execute();

            // Also mark the campaign as Processing
            $db->query("UPDATE email_campaigns SET status = 'Processing' WHERE id = :camId AND status = 'Queued'");
            $db->bind(':camId', $item->campaign_id);
            $db->execute();

            $res = EmailHelper::send($item->recipient_email, $item->subject, $item->content);

            // Log result
            $db->query("INSERT INTO email_logs (campaign_id, customer_id, recipient, subject, status, error_message) VALUES (:cam, :cid, :rec, :sub, :status, :err)");
            $db->bind(':cam', $item->campaign_id);
            $db->bind(':cid', $item->customer_id);
            $db->bind(':rec', $item->recipient_email);
            $db->bind(':sub', $item->subject);
            $db->bind(':status', $res['status'] === 'success' ? 'Success' : 'Failed');
            $db->bind(':err', $res['message'] ?? null);
            $db->execute();

            // Update Queue
            $status = $res['status'] === 'success' ? 'Sent' : 'Failed';
            $db->query("UPDATE email_queue SET status = :status, error_message = :err, processed_at = NOW(), attempts = attempts + 1 WHERE id = :id");
            $db->bind(':status', $status);
            $db->bind(':err', $res['message'] ?? null);
            $db->bind(':id', $item->id);
            $db->execute();

            $processed++;

            // Small delay between emails in the same batch
            usleep(500000); 
        }

        // Final sync after processing this batch
        $this->sync_campaign_statuses();

        $this->json([
            'status' => 'success', 
            'message' => "Processed $processed emails.",
            'processed' => $processed
        ]);
    }

    /**
     * Helper to synchronize campaign statuses based on queue progress.
     */
    private function sync_campaign_statuses() {
        $db = new Database();
        $db->query("SELECT id FROM email_campaigns WHERE status IN ('Queued', 'Processing', '')");
        $activeCampaigns = $db->resultSet();
        foreach ($activeCampaigns as $camp) {
            $db->query("SELECT COUNT(*) as remaining FROM email_queue WHERE campaign_id = :cam AND status IN ('Pending', 'Processing')");
            $db->bind(':cam', $camp->id);
            $row = $db->single();
            
            // If no emails are pending/processing, it is finished.
            if ($row && $row->remaining == 0) {
                $db->query("UPDATE email_campaigns SET status = 'Sent', sent_at = NOW() WHERE id = :cam");
                $db->bind(':cam', $camp->id);
                $db->execute();
            }
        }
    }

    /**
     * GET /api/email-marketing/logs
     */
    public function logs() {
        $db = new Database();
        $db->query("SELECT l.*, c.name as customer_name FROM email_logs l LEFT JOIN customers c ON l.customer_id = c.id ORDER BY l.id DESC LIMIT 100");
        $data = $db->resultSet();
        $this->json(['status' => 'success', 'data' => $data]);
    }

    /**
     * GET /api/EmailMarketing/media
     */
    public function media() {
        $db = new Database();
        try {
            $db->query("SELECT * FROM marketing_media ORDER BY id DESC");
            $data = $db->resultSet();
            $this->json(['status' => 'success', 'data' => $data]);
        } catch (Exception $e) {
            $this->json(['status' => 'success', 'data' => []]);
        }
    }

    /**
     * GET /api/EmailMarketing/segment-contacts?segment=all
     */
    public function segment_contacts() {
        $segment = $_GET['segment'] ?? 'all';
        $db = new Database();
        
        if ($segment === 'all') {
            $db->query("SELECT name, email, id FROM customers WHERE email IS NOT NULL AND email != '' LIMIT 1000");
        } else {
            $db->query("SELECT name, email, id FROM segment_contacts WHERE segment_id = :sid AND email IS NOT NULL AND email != ''");
            $db->bind(':sid', $segment);
        }
        
        $data = $db->resultSet();
        $this->json(['status' => 'success', 'data' => $data]);
    }
}
