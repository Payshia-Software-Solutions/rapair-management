<?php
/**
 * StorefrontSetting Model
 */
class StorefrontSetting extends Model {
    protected $table = 'storefront_settings';

    public static function complimentaryPackagingIds(array $settings): array {
        $ids = json_decode((string)($settings['packaging_complimentary_item_ids'] ?? '[]'), true);
        return is_array($ids) ? array_map('intval', $ids) : [];
    }

    /** The site FAQ: JSON list saved from ERP > E-commerce > FAQ. Only active items with a question and answer. */
    public static function faqItems(array $settings): array {
        $items = json_decode((string)($settings['faq_items'] ?? '[]'), true);
        if (!is_array($items)) return [];
        $out = [];
        foreach ($items as $item) {
            $q = trim((string)($item['question'] ?? ''));
            $a = trim((string)($item['answer'] ?? ''));
            if ($q === '' || $a === '' || (isset($item['active']) && $item['active'] === false)) continue;
            $out[] = ['question' => $q, 'answer' => $a];
        }
        return $out;
    }

    public static function giftCardItemId(array $settings): int {
        if ((int)($settings['packaging_category_id'] ?? 0) <= 0 || (string)($settings['gift_message_enabled'] ?? '1') !== '1') {
            return 0;
        }
        return (int)($settings['gift_message_item_id'] ?? 0);
    }

    public function seedHomepageBestSellerIds(array $settings, int $locationId): array {
        $ids = $this->homepageBestSellerIds($settings, $locationId);
        if (array_key_exists('homepage_best_seller_ids', $settings) || !$ids || $locationId <= 0) {
            return $ids;
        }

        $this->db->query("
            INSERT INTO storefront_settings (location_id, `key`, `value`, `label`, `group`, `type`)
            VALUES (:location, 'homepage_best_seller_ids', :ids, 'Homepage Best Sellers', 'promotions', 'text')
            ON DUPLICATE KEY UPDATE `key` = 'homepage_best_seller_ids'
        ");
        $this->db->bind(':location', $locationId);
        $this->db->bind(':ids', implode(',', $ids));
        $this->db->execute();

        // An admin may have saved a list between the original read and the seed.
        $this->db->query("
            SELECT `value` FROM storefront_settings
            WHERE location_id = :location AND `key` = 'homepage_best_seller_ids'
        ");
        $this->db->bind(':location', $locationId);
        $saved = $this->db->single();
        return $saved ? $this->parseHomepageProductIds((string)$saved->value) : $ids;
    }

    private function homepageBestSellerIds(array $settings, int $locationId): array {
        if (array_key_exists('homepage_best_seller_ids', $settings)) {
            return $this->parseHomepageProductIds($settings['homepage_best_seller_ids']);
        }
        $featured = $this->parseHomepageProductIds($settings['featured_product_ids'] ?? '');
        if ($featured) return $featured;

        $slugs = [
            'christmas-tea-advent-calendar--24-individually-wrapped-tea-bags',
            'flavored-black-tea-gift-pack---6-x-5-individually-wrapped-tea-bags',
            '-peach-flavored-25-enveloped-tea-bags',
            '-strawberry-flavored-25-enveloped-tea-bags',
            'ginger-flavored-black-tea-loose-leaf-175g',
            'earl-gray-15-leaf-tea-bags',
            'moraccan-mint-green-tea',
            'blue-sapphire-blueberry-mint-flavor-100g-loose-tea',
            'english-breakfast-tea-25-enveloped-tea-bags',
            'galpadithanne-op1-loose-leaf-125g',
        ];
        $slugParams = array_map(fn($index) => ':slug' . $index, array_keys($slugs));
        $slugList = implode(', ', $slugParams);
        $collectionMatch = "EXISTS (
            SELECT 1 FROM parts_collections pc JOIN collections c ON c.id = pc.collection_id
            WHERE pc.part_id = p.id AND c.show_in_public = 1 AND LOWER(TRIM(c.name)) = 'best sellers'
        )";
        $this->db->query("
            SELECT p.id, p.slug, $collectionMatch AS in_best_sellers
            FROM parts p
            WHERE p.is_active = 1 AND p.is_online = 1
              AND (p.allowed_locations IS NULL OR p.allowed_locations = '' OR FIND_IN_SET(:location, p.allowed_locations) > 0)
              AND (:packaging_disabled = 0 OR COALESCE(p.item_category_id, 0) <> :packaging_category)
            HAVING in_best_sellers = 1 OR slug IN ($slugList)
            ORDER BY p.part_name ASC, p.id ASC
        ");
        $packagingCategory = (int)($settings['packaging_category_id'] ?? 0);
        $this->db->bind(':location', $locationId);
        $this->db->bind(':packaging_disabled', $packagingCategory);
        $this->db->bind(':packaging_category', $packagingCategory);
        foreach ($slugs as $index => $slug) $this->db->bind($slugParams[$index], $slug);

        $collectionIds = [];
        $idsBySlug = [];
        foreach ($this->db->resultSet() as $part) {
            if ((int)$part->in_best_sellers === 1) $collectionIds[] = (int)$part->id;
            $idsBySlug[$part->slug] = (int)$part->id;
        }
        if ($collectionIds) return array_slice($collectionIds, 0, 10);
        return array_values(array_filter(array_map(fn($slug) => $idsBySlug[$slug] ?? null, $slugs)));
    }

    private function parseHomepageProductIds(string $selection): array {
        return self::parseProductIdList($selection);
    }

    /** "12,7,7,0,x" -> [12, 7]: positive, unique, in order, at most 10 (the homepage limit). */
    public static function parseProductIdList(string $selection): array {
        $ids = array_map('intval', explode(',', $selection));
        return array_slice(array_values(array_unique(array_filter($ids, fn($id) => $id > 0))), 0, 10);
    }

    public function getGrouped($locationId = 1) {
        require_once '../app/helpers/StorefrontSchema.php';
        StorefrontSchema::ensure();

        // 1. Get ALL defaults from location 1
        $this->db->query("SELECT * FROM {$this->table} WHERE location_id = 1");
        $defaultRows = $this->db->resultSet();
        
        $settingsMap = [];
        foreach ($defaultRows as $row) {
            $settingsMap[$row->key] = [
                'value' => $row->value,
                'group' => $row->group
            ];
        }

        // 2. Override with location-specific settings if locationId != 1
        if ($locationId != 1) {
            $this->db->query("SELECT * FROM {$this->table} WHERE location_id = :loc");
            $this->db->bind(':loc', $locationId);
            $locRows = $this->db->resultSet();
            foreach ($locRows as $row) {
                // We use the value from the specific location
                // But we preserve the group from location 1 if the current group is general/empty
                $group = $row->group;
                if (($group === 'general' || empty($group)) && isset($settingsMap[$row->key])) {
                    $group = $settingsMap[$row->key]['group'];
                }
                
                $settingsMap[$row->key] = [
                    'value' => $row->value,
                    'group' => $group
                ];
            }
        }

        // 3. Build grouped structure
        $grouped = [];
        foreach ($settingsMap as $key => $data) {
            $group = $data['group'];
            if (!isset($grouped[$group])) $grouped[$group] = [];
            $grouped[$group][$key] = $data['value'];

            // Flat key for fallback
            $grouped[$key] = $data['value'];
        }
        
        return $grouped;
    }

    public function getAll($locationId = 1) {
        require_once '../app/helpers/StorefrontSchema.php';
        StorefrontSchema::ensure();

        $this->db->query("SELECT * FROM {$this->table} WHERE location_id = :loc");
        $this->db->bind(':loc', $locationId);
        $rows = $this->db->resultSet();
        $res = [];
        foreach ($rows as $row) {
            $res[$row->key] = $row->value;
        }
        return $res;
    }

    public function updateSetting($key, $value, $locationId = 1) {
        // First, check if this setting exists for ANY location to get its group, label, and type
        $this->db->query("SELECT `group`, `label`, `type` FROM {$this->table} WHERE `key` = :key LIMIT 1");
        $this->db->bind(':key', $key);
        $template = $this->db->single();

        $group = $template->group ?? 'general';
        $label = $template->label ?? $key;
        $type = $template->type ?? 'text';

        // Use UPSERT logic since we now have location_id
        $this->db->query("INSERT INTO {$this->table} (location_id, `key`, `value`, `group`, `label`, `type`) 
                         VALUES (:loc, :key, :val, :grp, :lbl, :typ) 
                         ON DUPLICATE KEY UPDATE `value` = :val2");
        $this->db->bind(':loc', $locationId);
        $this->db->bind(':key', $key);
        $this->db->bind(':val', $value);
        $this->db->bind(':grp', $group);
        $this->db->bind(':lbl', $label);
        $this->db->bind(':typ', $type);
        $this->db->bind(':val2', $value);
        return $this->db->execute();
    }
}
