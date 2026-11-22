<?php
/**
 * Print stations (Kitchen KOT, Bar BOT, ...): item -> station -> printer.
 * Shared by the server print queue (PrintqueueController) and the direct-print KOT page (PosController).
 */
class PrintStationHelper {
    /** Active stations of a location, default first. [] when the location has none set up. */
    public static function locationStations($db, $locationId) {
        try {
            $db->query("SELECT * FROM print_stations WHERE location_id = :l AND is_active = 1 ORDER BY is_default DESC, id ASC");
            $db->bind(':l', (int)$locationId);
            return $db->resultSet() ?: [];
        } catch (Exception $e) { return []; }
    }

    /**
     * Split items + voids by station. Each item goes to its own station, else the location's
     * default station. No stations set up = one group with station null (one KOT like before).
     * @return array of ['station' => obj|null, 'items' => [], 'voids' => []] in station order
     */
    public static function group($db, $locationId, $items, $voids) {
        $stations = self::locationStations($db, $locationId);
        if (!$stations) return [['station' => null, 'items' => $items, 'voids' => $voids]];
        $byId = []; foreach ($stations as $st) $byId[(int)$st->id] = $st;
        $default = $stations[0];

        $ids = [];
        foreach (array_merge($items, $voids) as $r) if (!empty($r->item_id)) $ids[(int)$r->item_id] = true;
        $itemStation = [];
        if ($ids) {
            $db->query("SELECT id, print_station_id FROM parts WHERE id IN (" . implode(',', array_keys($ids)) . ")");
            foreach ($db->resultSet() as $p) $itemStation[(int)$p->id] = (int)$p->print_station_id;
        }
        $pick = function ($r) use ($itemStation, $byId, $default) {
            $sid = $itemStation[(int)($r->item_id ?? 0)] ?? 0;
            return isset($byId[$sid]) ? $byId[$sid] : $default;
        };
        $groups = [];
        foreach ($items as $r) { $st = $pick($r); $groups[$st->id]['items'][] = $r; }
        foreach ($voids as $r) { $st = $pick($r); $groups[$st->id]['voids'][] = $r; }
        $out = [];
        foreach ($stations as $st) {
            if (!isset($groups[$st->id])) continue;
            $out[] = ['station' => $st, 'items' => $groups[$st->id]['items'] ?? [], 'voids' => $groups[$st->id]['voids'] ?? []];
        }
        return $out;
    }
}
