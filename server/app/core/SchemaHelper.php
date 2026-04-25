<?php
class SchemaHelper {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * Captures the current database state (Not needed anymore since it's hardcoded, 
     * but could be used to generate the hardcoded file content)
     */
    public function getSnapshot() {
        // ... (can be used by a generator script)
    }

    /**
     * Compares the live database with the hardcoded definition
     */
    public function getDiff($tableNameFilter = null) {
        require_once dirname(__FILE__) . '/SchemaDefinition.php';
        $defined = SchemaDefinition::get();
        
        // Filter defined if tableNameFilter is provided
        if ($tableNameFilter) {
            if (!isset($defined[$tableNameFilter])) return ['error' => "Table $tableNameFilter not found in definition."];
            $defined = [$tableNameFilter => $defined[$tableNameFilter]];
        }

        // Get Live
        $res = $this->db->rawQuery("SHOW TABLES");
        $liveTablesList = $res->fetchAll(PDO::FETCH_COLUMN);
        
        $diff = [
            'defined_table_count' => count(SchemaDefinition::get()),
            'live_table_count' => count($liveTablesList),
            'missing_tables' => [],
            'missing_columns' => [],
            'missing_indexes' => []
        ];

        $live = [];
        foreach ($liveTablesList as $t) {
            $live[$t] = ['columns' => [], 'indexes' => []];
            $resCol = $this->db->rawQuery("DESCRIBE `$t` ");
            while ($c = $resCol->fetch(PDO::FETCH_ASSOC)) $live[$t]['columns'][$c['Field']] = $c;
            
            $resIdx = $this->db->rawQuery("SHOW INDEX FROM `$t` ");
            while ($i = $resIdx->fetch(PDO::FETCH_ASSOC)) {
                $key = $i['Key_name'];
                if (!isset($live[$t]['indexes'][$key])) $live[$t]['indexes'][$key] = ['Key_name' => $key, 'Columns' => []];
                $live[$t]['indexes'][$key]['Columns'][] = $i['Column_name'];
            }
        }

        foreach ($defined as $tableName => $table) {
            if (!isset($live[$tableName])) {
                $diff['missing_tables'][] = $tableName;
                continue;
            }

            // Check Columns
            foreach ($table['columns'] as $colName => $col) {
                if (!isset($live[$tableName]['columns'][$colName])) {
                    $diff['missing_columns'][] = [
                        'table' => $tableName,
                        'column' => $colName,
                        'definition' => $col['Type'] . ($col['Null'] === 'NO' ? ' NOT NULL' : '') . ($col['Default'] ? " DEFAULT '{$col['Default']}'" : "")
                    ];
                }
            }

            // Check Indexes
            foreach ($table['indexes'] as $keyName => $idx) {
                if (!isset($live[$tableName]['indexes'][$keyName])) {
                    $diff['missing_indexes'][] = [
                        'table' => $tableName,
                        'index' => $keyName,
                        'columns' => $idx['Columns'],
                        'unique' => $idx['Non_unique'] == 0
                    ];
                }
            }
        }

        return $diff;
    }

    /**
     * Applies missing columns and indexes to the live database
     */
    public function sync($diff) {
        $results = [];

        // Note: Missing tables are complex to automate without full CREATE SQL.
        // We'll focus on Columns and Indexes for now.

        foreach ($diff['missing_columns'] as $col) {
            $sql = "ALTER TABLE `{$col['table']}` ADD COLUMN `{$col['column']}` {$col['definition']}";
            try {
                $this->db->exec($sql);
                $results[] = "Added column {$col['column']} to {$col['table']}";
            } catch (Exception $e) {
                $results[] = "Error adding column {$col['column']}: " . $e->getMessage();
            }
        }

        foreach ($diff['missing_indexes'] as $idx) {
            $type = $idx['unique'] ? "UNIQUE INDEX" : "INDEX";
            $cols = implode("`, `", $idx['columns']);
            $sql = "ALTER TABLE `{$idx['table']}` ADD $type `{$idx['index']}` (`$cols`)";
            try {
                $this->db->exec($sql);
                $results[] = "Added index {$idx['index']} to {$idx['table']}";
            } catch (Exception $e) {
                $results[] = "Error adding index {$idx['index']}: " . $e->getMessage();
            }
        }

        return $results;
    }
}
