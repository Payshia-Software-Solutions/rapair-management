<?php
namespace App\Models;

use App\Core\Database;

/**
 * Products Nexus sells. A product with a provision_url runs customer workspaces and is told about
 * subscription changes by webhook; products without one (e.g. website care) are billing-only.
 */
class ProductModel {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    /** List for the admin: the webhook secret is never sent, only whether one is set. */
    public function getAll() {
        $this->db->query("
            SELECT p.id, p.product_key, p.name, p.description, p.provision_url, p.workspace_domain, p.is_active, p.created_at,
                   (p.webhook_secret IS NOT NULL AND p.webhook_secret <> '') AS has_secret,
                   (SELECT COUNT(*) FROM saas_packages k WHERE k.product_id = p.id) AS package_count
            FROM saas_products p ORDER BY p.name
        ");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM saas_products WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    /** Product of a tenant's package (null when the package has no product). */
    public function getForTenant($tenantId) {
        $this->db->query("
            SELECT p.* FROM saas_tenants t
            INNER JOIN saas_packages k ON k.id = t.package_id
            INNER JOIN saas_products p ON p.id = k.product_id
            WHERE t.id = :id
        ");
        $this->db->bind(':id', (int)$tenantId);
        return $this->db->single();
    }

    public function save(array $d) {
        $key = strtolower(trim($d['product_key'] ?? ''));
        if (!preg_match('/^[a-z0-9][a-z0-9_-]{1,48}$/', $key)) throw new \InvalidArgumentException('Product key: 2-50 letters, numbers, - or _');
        if (trim($d['name'] ?? '') === '') throw new \InvalidArgumentException('Product name is required');
        $url = trim($d['provision_url'] ?? '');
        if ($url !== '' && !preg_match('#^https?://#i', $url)) throw new \InvalidArgumentException('Provisioning URL must start with https://');
        $domain = strtolower(trim($d['workspace_domain'] ?? ''));

        if (!empty($d['id'])) {
            // Secret: only replaced when a new one is typed
            $setSecret = isset($d['webhook_secret']) && $d['webhook_secret'] !== '';
            $this->db->query("UPDATE saas_products SET product_key = :k, name = :n, description = :d, provision_url = :u,
                              workspace_domain = :w, is_active = :a" . ($setSecret ? ", webhook_secret = :s" : "") . " WHERE id = :id");
            $this->db->bind(':id', (int)$d['id']);
            if ($setSecret) $this->db->bind(':s', $d['webhook_secret']);
        } else {
            $this->db->query("INSERT INTO saas_products (product_key, name, description, provision_url, workspace_domain, is_active, webhook_secret)
                              VALUES (:k, :n, :d, :u, :w, :a, :s)");
            $this->db->bind(':s', ($d['webhook_secret'] ?? '') !== '' ? $d['webhook_secret'] : null);
        }
        $this->db->bind(':k', $key);
        $this->db->bind(':n', trim($d['name']));
        $this->db->bind(':d', trim($d['description'] ?? '') ?: null);
        $this->db->bind(':u', $url ?: null);
        $this->db->bind(':w', $domain ?: null);
        $this->db->bind(':a', !empty($d['is_active']) ? 1 : 0);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("SELECT COUNT(*) AS n FROM saas_packages WHERE product_id = :id");
        $this->db->bind(':id', (int)$id);
        if ((int)$this->db->single()->n > 0) throw new \InvalidArgumentException('Move or delete this product\'s packages first');
        $this->db->query("DELETE FROM saas_products WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function setPackageProduct($packageId, $productId) {
        $this->db->query("UPDATE saas_packages SET product_id = :p WHERE id = :id");
        $this->db->bind(':p', $productId ? (int)$productId : null);
        $this->db->bind(':id', (int)$packageId);
        return $this->db->execute();
    }
}
