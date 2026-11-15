<?php
declare(strict_types=1);

namespace ReGen\Actions;

use ReGen\{AuditLogger, CampaignService, ConcurrentUpdate, Http, RateLimiter, Sanitizer, Session, SupportRepository};

trait AdminWorkspaceActions
{
    /** Authentication, CSRF and module scopes are enforced before this dispatcher. */
    private function workspaceRoutes(string $path, string $method): void
    {
        try {
            if ($path === '/api/admin/campaigns') {
                $campaigns = new CampaignService($this->db);
                if ($method === 'GET') {
                    Http::json(['success' => true, ...$campaigns->listing((int) ($_GET['page'] ?? 1))]);
                }
                if ($method === 'POST') {
                    $id = $campaigns->save(null, Http::jsonBody(), Session::adminId());
                    Http::json(['success' => true, 'id' => $id], 201);
                }
            }
            if (preg_match('#^/api/admin/campaigns/(\d+)$#D', $path, $match) && $method === 'PUT') {
                $id = (new CampaignService($this->db))->save((int) $match[1], Http::jsonBody(), Session::adminId());
                Http::json(['success' => true, 'id' => $id]);
            }
            if ($path === '/api/campaigns' && $method === 'GET') {
                Http::json(['success' => true, ...(new CampaignService($this->db))->forUser(Session::userId())]);
            }
            if (preg_match('#^/api/campaigns/(\d+)(?:/(claim|dismiss))?$#D', $path, $match)) {
                $this->campaignUserAction((int) $match[1], $match[2] ?? '', $method);
            }
            if ($path === '/api/admin/profile' && $method === 'PUT') {
                $this->updateAdministratorProfile();
            }
            if (preg_match('#^/api/admin/users/(\d+)/sessions$#D', $path, $match) && $method === 'GET') {
                $this->administratorUserSessions((int) $match[1]);
            }
            if (preg_match('#^/api/admin/tickets/(\d+)/reopen$#D', $path, $match) && $method === 'POST') {
                (new SupportRepository($this->db))->reopen(
                    (int) $match[1], Session::adminId(), (int) (Http::jsonBody()['version'] ?? 0)
                );
                Http::json(['success' => true]);
            }
        } catch (ConcurrentUpdate $error) {
            Http::json(['success' => false, 'message' => $error->getMessage()], 409);
        } catch (\OutOfBoundsException $error) {
            Http::json(['success' => false, 'message' => $error->getMessage()], 404);
        } catch (\DomainException $error) {
            Http::json(['success' => false, 'message' => $error->getMessage()], 422);
        }
    }

    private function campaignUserAction(int $id, string $action, string $method): void
    {
        $campaigns = new CampaignService($this->db);
        $userId = Session::userId();
        if ($method === 'GET' && $action === '') {
            Http::json(['success' => true, 'campaign' => $campaigns->detail($id, $userId)]);
        }
        if ($method === 'POST' && $action === 'dismiss') {
            $campaigns->dismiss($id, $userId);
            Http::json(['success' => true]);
        }
        if ($method === 'POST' && $action === 'claim') {
            RateLimiter::enforce('campaign-claim', (string) $userId, 20, 3600);
            $reference = (string) (Http::jsonBody()['requestKey'] ?? '');
            Http::json(['success' => true, ...$campaigns->claim($id, $userId, $reference)]);
        }
    }

    private function updateAdministratorProfile(): never
    {
        $body = Http::jsonBody();
        $first = Sanitizer::cleanText($body['firstName'] ?? '', false, 80);
        $last = Sanitizer::cleanText($body['lastName'] ?? '', false, 80);
        if ($first === '' || $last === '') {
            throw new \DomainException('Enter your first and last names.');
        }
        $id = Session::adminId();
        $before = $this->admins->findById($id);
        if ((bool) $before['is_bootstrap']) {
            throw new \DomainException('Create a personal administrator account to manage your profile.');
        }
        $this->db->prepare('UPDATE admins SET first_name=?, last_name=? WHERE id=?')->execute([$first, $last, $id]);
        (new AuditLogger($this->db))->log('admin.profile_updated', 'admin', $id, [
            'before' => ['firstName' => $before['first_name'], 'lastName' => $before['last_name']],
            'after' => ['firstName' => $first, 'lastName' => $last],
        ], 'admin', $id);
        Http::json(['success' => true, 'admin' => $this->admins->findById($id)]);
    }

    private function administratorUserSessions(int $id): never
    {
        if (!$this->admins->userById($id)) {
            throw new \OutOfBoundsException('Account not found.');
        }
        $count = $this->db->prepare('SELECT COUNT(*) FROM account_sessions WHERE user_id=?');
        $count->execute([$id]);
        $total = (int) $count->fetchColumn();
        $pages = max(1, (int) ceil($total / 10));
        $page = min($pages, max(1, (int) ($_GET['page'] ?? 1)));
        $query = $this->db->prepare(
            'SELECT id, device_label, browser_label, last_seen_at, created_at, revoked_at
             FROM account_sessions WHERE user_id=? ORDER BY last_seen_at DESC, id DESC
             LIMIT 10 OFFSET ' . (($page - 1) * 10)
        );
        $query->execute([$id]);
        Http::json(['success' => true, 'items' => $query->fetchAll(), 'total' => $total, 'page' => $page, 'pageSize' => 10]);
    }
}
