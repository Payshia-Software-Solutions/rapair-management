<?php
/**
 * WorkspaceController
 * GET /api/workspace/info -> which workspace this request belongs to (public, no login).
 * The web app uses the slug for content-server image URLs on custom domains.
 * Single-client installs answer {"mode":"single"}.
 */
class WorkspaceController extends Controller {
    public function info() {
        if (class_exists('Tenancy', false) && Tenancy::enabled()) {
            $t = Tenancy::current();
            $this->success(['mode' => 'shared', 'slug' => $t['slug'], 'name' => $t['name']]);
            return;
        }
        $this->success(['mode' => 'single']);
    }
}
