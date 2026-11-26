import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'app_lock.dart';
import 'approval_service.dart';
import 'push_service.dart';

class Location {
  final int id;
  final String name;
  const Location(this.id, this.name);
  factory Location.fromJson(Map<String, dynamic> j) =>
      Location(int.tryParse('${j['id']}') ?? 0, '${j['name'] ?? 'Location'}');
}

/// Signed-in user, their locations and what the app may show them.
class Session extends ChangeNotifier {
  final _api = ApiClient.instance;

  bool ready = false;
  String? name;
  String? email;
  String? role;
  List<Location> locations = [];
  Set<String> permissions = {};

  bool get signedIn => _api.hasToken && name != null;
  bool get isAdmin => (role ?? '').toLowerCase() == 'admin' || permissions.contains('*');

  /// Dashboards need report access; anyone can use the approvals inbox
  /// (the server only lists requests the user may act on).
  bool get canSeeDashboards => isAdmin || permissions.contains('reports.read');

  /// Workshop section of the dashboard (/dashboard/overview needs orders.read).
  bool get canSeeOperations => isAdmin || permissions.contains('orders.read');

  Location? get currentLocation {
    final id = _api.locationId;
    for (final l in locations) {
      if (l.id == id) return l;
    }
    return null;
  }

  Future<void> init() async {
    await _api.load();
    _api.onUnauthorized = _onUnauthorized;
    if (_api.hasToken && _api.tokenExpired) await _api.clearSession();
    if (_api.hasToken) {
      // Cached first: /auth/me has no location list, that only comes from login.
      await _loadCachedProfile();
      try {
        await _loadProfile();
        refreshLocations();
        PushService.instance.registerCurrentDevice();
      } catch (_) {
        // Offline: keep the cached identity. Expired: the 401 already cleared the session.
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await _api.post('/auth/login', {'email': email.trim(), 'password': password});
    final token = data?['token']?.toString();
    if (token == null || token.isEmpty) throw ApiException(0, 'Login failed.');
    await _api.saveToken(token);
    AppLock.instance.reset(); // password just proved who this is

    final user = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
    _applyUser(user);
    if (locations.isNotEmpty && currentLocation == null) {
      final def = int.tryParse('${user['location_id']}');
      await _api.saveLocation(locations.any((l) => l.id == def) ? def : locations.first.id);
    }
    await _loadPermissions();
    await _cacheProfile();
    notifyListeners();
    refreshLocations();
    PushService.instance.registerCurrentDevice();
  }

  Future<void> logout() async {
    await PushService.instance.unregisterCurrentDevice();
    await _api.clearSession();
    _clear();
    AppLock.instance.reset();
    notifyListeners();
  }

  /// Locations come from login (the user's assignments) and go stale when a branch is added later.
  /// Admins see every location (/location/list); others keep only locations they're assigned to,
  /// with names refreshed. Never throws.
  Future<void> refreshLocations() async {
    try {
      final d = await _api.get('/location/list');
      final all = (d is List ? d : const [])
          .whereType<Map>()
          .map((m) => Location.fromJson(m.cast<String, dynamic>()))
          .where((l) => l.id > 0)
          .toList();
      if (all.isEmpty) return;
      final next = isAdmin ? all : all.where((l) => locations.any((a) => a.id == l.id)).toList();
      if (next.isEmpty) return;
      final changed = next.length != locations.length || next.any((l) => !locations.any((a) => a.id == l.id && a.name == l.name));
      if (!changed) return;
      locations = next;
      await _cacheProfile();
      notifyListeners();
    } catch (_) {}
  }

  /// Sign out and forget the company: the app goes back to "Scan QR code".
  Future<void> switchCompany() async {
    await PushService.instance.unregisterCurrentDevice();
    await _api.clearSession();
    await _api.clearServer();
    final p = await SharedPreferences.getInstance();
    for (final k in ['profile_name', 'profile_email', 'profile_role', 'profile_perms', 'profile_locs']) {
      await p.remove(k);
    }
    _clear();
    AppLock.instance.reset();
    notifyListeners();
  }

  Future<void> switchLocation(int id) async {
    await _api.saveLocation(id);
    notifyListeners();
  }

  // ---------- internals ----------

  Future<void> _loadProfile() async {
    final me = await _api.get('/auth/me');
    final user = (me is Map && me['user'] is Map ? me['user'] : me) as Map?;
    _applyUser(user?.cast<String, dynamic>() ?? {});
    await _loadPermissions();
    await _cacheProfile();
  }

  Future<void> _loadPermissions() async {
    final p = await _api.get('/auth/permissions');
    permissions = (p is List ? p : const []).map((e) => '$e').toSet();
  }

  void _applyUser(Map<String, dynamic> u) {
    name = u['name']?.toString() ?? name ?? 'User';
    email = u['email']?.toString() ?? email;
    role = u['role']?.toString() ?? role;
    final locs = u['allowed_locations'];
    if (locs is List && locs.isNotEmpty) {
      locations = locs.whereType<Map>().map((m) => Location.fromJson(m.cast<String, dynamic>())).toList();
    } else if (u['location_id'] != null && locations.isEmpty) {
      locations = [Location(int.tryParse('${u['location_id']}') ?? 1, '${u['location_name'] ?? 'Main'}')];
    }
  }

  Future<void> _cacheProfile() async {
    final p = await SharedPreferences.getInstance();
    await p.setString('profile_name', name ?? '');
    await p.setString('profile_email', email ?? '');
    await p.setString('profile_role', role ?? '');
    await p.setStringList('profile_perms', permissions.toList());
    await p.setStringList('profile_locs', locations.map((l) => '${l.id}|${l.name}').toList());
  }

  Future<void> _loadCachedProfile() async {
    if (!_api.hasToken) return;
    final p = await SharedPreferences.getInstance();
    final n = p.getString('profile_name');
    if (n == null || n.isEmpty) return;
    name = n;
    email = p.getString('profile_email');
    role = p.getString('profile_role');
    permissions = (p.getStringList('profile_perms') ?? []).toSet();
    locations = (p.getStringList('profile_locs') ?? []).map((s) {
      final i = s.indexOf('|');
      return Location(int.tryParse(s.substring(0, i)) ?? 0, s.substring(i + 1));
    }).toList();
  }

  void _clear() {
    ApprovalService.instance.inboxCount = 0;
    name = email = role = null;
    locations = [];
    permissions = {};
  }

  void _onUnauthorized() {
    _clear();
    notifyListeners();
  }
}
