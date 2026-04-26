<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\RequestModel;

class PortalController extends Controller {
    public function submitRequest() {
        $data = $this->getPostData();
        
        if (empty($data['company_name']) || empty($data['email'])) {
            return $this->json(['status' => 'error', 'message' => 'Missing required fields'], 400);
        }

        $model = new RequestModel();
        if ($model->create($data)) {
            return $this->json(['status' => 'success', 'message' => 'Your ERP order request has been submitted. Our team will contact you soon.']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Submission failed'], 500);
        }
    }
}
