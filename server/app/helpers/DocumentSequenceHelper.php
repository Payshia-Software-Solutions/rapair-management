<?php
/**
 * Document Sequence Helper
 */
class DocumentSequenceHelper {
    public static function getNext($docType) {
        $db = new Database();
        $db->beginTransaction();
        try {
            $db->query("SELECT prefix, next_number, padding FROM document_sequences WHERE doc_type = :type FOR UPDATE");
            $db->bind(':type', $docType);
            $seq = $db->single();
            
            if (!$seq) {
                $db->rollBack();
                return $docType . '-' . time();
            }

            $docNo = $seq->prefix . str_pad($seq->next_number, $seq->padding, '0', STR_PAD_LEFT);

            // Update sequence
            $db->query("UPDATE document_sequences SET next_number = next_number + 1 WHERE doc_type = :type");
            $db->bind(':type', $docType);
            $db->execute();

            $db->commit();
            return $docNo;
        } catch (Exception $e) {
            $db->rollBack();
            return $docType . '-' . time();
        }
    }
}
