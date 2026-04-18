<?php
/**
 * ProductionService
 * Coordinates stock movements and accounting for the Production Module.
 */
class ProductionService {
    
    /**
     * Start Production (Consume Materials)
     * Moves stock from Inventory to WIP.
     */
    public static function startProduction($orderId, $userId) {
        $orderModel = new ProductionOrder();
        $partModel = new Part();
        $journalModel = new Journal();
        
        $order = $orderModel->getById($orderId);
        if (!$order || $order->status !== 'Planned') {
            return ['success' => false, 'message' => 'Order not in Planned status.'];
        }

        $items = $orderModel->getItems($orderId);
        if (empty($items)) {
            return ['success' => false, 'message' => 'No materials defined for this BOM.'];
        }

        $wipId = AccountingHelper::getMappedId('production_wip');
        $invId = AccountingHelper::getMappedId('grn_inventory');

        if (!$wipId || !$invId) {
            return ['success' => false, 'message' => 'Accounting mappings for Production/Inventory not found.'];
        }

        try {
            // 1. Process Stock Movements
            $totalCost = 0;
            $journalItems = [];

            foreach ($items as $item) {
                $qty = (float)$item->planned_qty;
                $cost = (float)$item->unit_cost;
                $lineValue = $qty * $cost;
                $totalCost += $lineValue;

                // Deduct from Inventory
                $ok = $partModel->adjustStock(
                    $item->part_id, 
                    -$qty, 
                    "Production Consumption: {$order->order_number}", 
                    $userId, 
                    $order->location_id, 
                    'PRODUCTION_CONSUMPTION'
                );

                if (!$ok) {
                    throw new Exception("Insufficient stock or failed to deduct part ID: {$item->part_id}");
                }
            }

            // 2. Journal Entry (WIP)
            $journalItems[] = [
                'account_id' => $wipId,
                'debit' => $totalCost,
                'credit' => 0,
                'notes' => "Material Issuance for MO: {$order->order_number}"
            ];
            $journalItems[] = [
                'account_id' => $invId,
                'debit' => 0,
                'credit' => $totalCost,
                'notes' => "Inventory Consumed for Production"
            ];

            $journalModel->post([
                'entry_date' => date('Y-m-d'),
                'description' => "Material Issuance - MO #{$order->order_number}",
                'ref_type' => 'ProductionOrder',
                'ref_id' => $orderId,
                'userId' => $userId,
                'items' => $journalItems
            ]);

            // 3. Update Order Status
            $orderModel->updateStatus($orderId, 'InProgress', $userId);

            return ['success' => true, 'message' => 'Production started and materials consumed.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public static function completeProduction($orderId, $userId, $actualYield = null, $wasteReason = null, $outputYields = null) {
        $orderModel = new ProductionOrder();
        $partModel = new Part();
        $journalModel = new Journal();
        
        $order = $orderModel->getById($orderId);
        if (!$order || $order->status !== 'InProgress') {
            return ['success' => false, 'message' => 'Order not In Progress.'];
        }

        $wipId = AccountingHelper::getMappedId('production_wip');
        $invId = AccountingHelper::getMappedId('grn_inventory');

        if (!$wipId || !$invId) {
            return ['success' => false, 'message' => 'Accounting mappings for Production/Inventory not found.'];
        }

        try {
            $db = $orderModel->getDb();
            $db->exec("START TRANSACTION");

            // 1. Calculate Total Material Cost
            $items = $orderModel->getItems($orderId);
            $totalCost = 0;
            foreach ($items as $item) {
                $qty = (float)($item->actual_qty ?? $item->planned_qty);
                $cost = (float)$item->unit_cost;
                $totalCost += ($qty * $cost);
            }

            // 2. Process Outputs
            $outputs = $order->outputs ?? [];
            $totalActualYield = 0;
            
            foreach ($outputs as $out) {
                $outId = (int)$out->id;
                
                // Find matching yield data from input
                $yieldQty = (float)$out->planned_qty;
                $outWaste = $wasteReason; // default if single legacy param used

                if ($outputYields && is_array($outputYields)) {
                    foreach ($outputYields as $iy) {
                        if ($iy['id'] == $outId) {
                            $yieldQty = (float)$iy['actual_yield'];
                            $outWaste = $iy['waste_reason'] ?? null;
                            break;
                        }
                    }
                } else if ($actualYield !== null && count($outputs) === 1) {
                    // Legacy single-item support
                    $yieldQty = (float)$actualYield;
                }

                $totalActualYield += $yieldQty;

                // Receipt into stock
                $partModel->adjustStock(
                    $out->part_id, 
                    $yieldQty, 
                    "Production Entry: {$order->order_number}", 
                    $userId, 
                    $order->location_id, 
                    'PRODUCTION_RECEIPT'
                );

                // Update output record
                $db->query("UPDATE production_order_outputs 
                           SET actual_qty = :q, waste_reason = :r 
                           WHERE id = :id");
                $db->bind(':q', $yieldQty);
                $db->bind(':r', $outWaste);
                $db->bind(':id', $outId);
                $db->execute();
            }

            // 3. Journal Entry (Consolidated Finished Goods Receipt)
            $journalItems = [];
            $journalItems[] = [
                'account_id' => $invId,
                'debit' => $totalCost,
                'credit' => 0,
                'notes' => "Finished Goods Receipt - Batch #{$order->order_number}"
            ];
            $journalItems[] = [
                'account_id' => $wipId,
                'debit' => 0,
                'credit' => $totalCost,
                'notes' => "Clearing WIP for Batch #{$order->order_number}"
            ];

            $journalModel->post([
                'entry_date' => date('Y-m-d'),
                'description' => "Production Receipt - Batch #{$order->order_number}",
                'ref_type' => 'ProductionOrder',
                'ref_id' => $orderId,
                'userId' => $userId,
                'items' => $journalItems
            ]);

            // 4. Update Header Status
            $db->query("UPDATE production_orders 
                       SET status = 'Completed', 
                           actual_yield = :y, 
                           waste_reason = :r, 
                           completed_at = NOW(), 
                           updated_by = :u 
                       WHERE id = :id");
            $db->bind(':y', $totalActualYield);
            $db->bind(':r', $wasteReason); // Primary waste reason if any
            $db->bind(':u', $userId);
            $db->bind(':id', $orderId);
            $db->execute();

            $db->exec("COMMIT");
            return ['success' => true, 'message' => 'Production batch completed and items received.'];
        } catch (Exception $e) {
            try { $db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
