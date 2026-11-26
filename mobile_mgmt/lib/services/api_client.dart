import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

/// Error from the API, with the server's message when it sent one.
class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

/// Single entry point for every API call (mirrors front-end/src/lib/api/client.ts):
/// adds Bearer token, X-Location-Id and, for shared workspaces, X-Tenant-Host.
/// A 401 clears the session and calls [onUnauthorized].
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _kBaseUrl = 'base_url';
  static const _kTenantHost = 'tenant_host';
  static const _kLocationId = 'location_id';
  static const _kToken = 'auth_token';
  static const _kWorkspaceName = 'workspace_name';

  String? baseUrl; // ends with /api, no trailing slash
  String? tenantHost; // workspace domain for shared mode; null for single installs
  int? locationId;
  String? workspaceName; // company name shown on login / profile
  String? _token;

  void Function()? onUnauthorized;

  bool get isConfigured => baseUrl != null && baseUrl!.isNotEmpty;
  bool get hasToken => _token != null && _token!.isNotEmpty;

  /// True when the JWT's `exp` has passed (server TTL is JWT_TTL_SECONDS, 8 h by default).
  bool get tokenExpired {
    final parts = (_token ?? '').split('.');
    if (parts.length != 3) return true;
    try {
      final claims = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1])))) as Map;
      final exp = claims['exp'];
      return exp is num && DateTime.now().millisecondsSinceEpoch ~/ 1000 >= exp;
    } catch (_) {
      return false; // can't read it: let the server decide
    }
  }

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    baseUrl = p.getString(_kBaseUrl);
    // Builds before 1.0.0 saved a wrong cloud address; move those installs to the real one.
    if (baseUrl == 'https://api.bizzflow.nebulync.com/server/public/api') {
      baseUrl = normalizeBaseUrl(AppConfig.cloudApi);
      await p.setString(_kBaseUrl, baseUrl!);
    }
    tenantHost = p.getString(_kTenantHost);
    locationId = p.getInt(_kLocationId);
    workspaceName = p.getString(_kWorkspaceName);
    _token = await _secure.read(key: _kToken);
  }

  /// Accepts "https://host", "https://host/server/public" or ".../api" and stores ".../api".
  static String normalizeBaseUrl(String raw) {
    var u = raw.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://$u';
    while (u.endsWith('/')) {
      u = u.substring(0, u.length - 1);
    }
    if (!u.endsWith('/api')) u = '$u/api';
    return u;
  }

  Future<void> saveServer(String url, String? workspace) async {
    final p = await SharedPreferences.getInstance();
    baseUrl = normalizeBaseUrl(url);
    final ws = workspace?.trim().toLowerCase().replaceAll(RegExp(r'^https?://'), '').replaceAll(RegExp(r'/.*$'), '');
    tenantHost = (ws == null || ws.isEmpty) ? null : ws;
    await p.setString(_kBaseUrl, baseUrl!);
    if (tenantHost == null) {
      await p.remove(_kTenantHost);
    } else {
      await p.setString(_kTenantHost, tenantHost!);
    }
  }

  /// Calls the public /workspace/info with the saved server; stores and returns the company name.
  /// Throws [ApiException] with a friendly message when the company or server is wrong.
  Future<String> verifyConnection() async {
    try {
      final d = await get('/workspace/info');
      final name = (d is Map && d['mode'] == 'shared') ? '${d['name'] ?? tenantHost}' : 'Your server';
      workspaceName = name;
      final p = await SharedPreferences.getInstance();
      await p.setString(_kWorkspaceName, name);
      return name;
    } on ApiException catch (e) {
      if (e.status == 404) throw ApiException(404, 'We could not find that company. Check the name and try again.');
      if (e.status == 0) throw ApiException(0, 'Cannot reach the server. Check your internet connection.');
      rethrow;
    }
  }

  Future<void> saveToken(String token) async {
    _token = token;
    await _secure.write(key: _kToken, value: token);
  }

  Future<void> saveLocation(int? id) async {
    final p = await SharedPreferences.getInstance();
    locationId = id;
    if (id == null) {
      await p.remove(_kLocationId);
    } else {
      await p.setInt(_kLocationId, id);
    }
  }

  /// Forget the company/server too, so the app opens on the QR setup screen.
  Future<void> clearServer() async {
    final p = await SharedPreferences.getInstance();
    baseUrl = null;
    tenantHost = null;
    workspaceName = null;
    await p.remove(_kBaseUrl);
    await p.remove(_kTenantHost);
    await p.remove(_kWorkspaceName);
  }

  Future<void> clearSession() async {
    _token = null;
    await _secure.delete(key: _kToken);
    await saveLocation(null);
  }

  Map<String, String> _headers([int? locationOverride]) => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        if (hasToken) 'Authorization': 'Bearer $_token',
        if ((locationOverride ?? locationId) != null) 'X-Location-Id': '${locationOverride ?? locationId}',
        if (tenantHost != null) 'X-Tenant-Host': tenantHost!,
      };

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    if (!isConfigured) throw ApiException(0, 'Server is not set up.');
    final p = path.startsWith('/') ? path : '/$path';
    final u = Uri.parse('$baseUrl$p');
    if (query == null || query.isEmpty) return u;
    return u.replace(queryParameters: {
      ...u.queryParameters,
      ...query.map((k, v) => MapEntry(k, '$v')),
    });
  }

  /// [locationId] overrides X-Location-Id for this call (e.g. a document from another branch;
  /// the server still only allows locations the user is assigned to).
  Future<dynamic> get(String path, {Map<String, dynamic>? query, int? locationId}) =>
      _send(() => http.get(_uri(path, query), headers: _headers(locationId)));

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _send(() => http.post(_uri(path), headers: _headers(), body: jsonEncode(body ?? {})));

  /// Returns the `data` field of `{status, message, data}`; throws [ApiException] otherwise.
  Future<dynamic> _send(Future<http.Response> Function() call) async {
    http.Response res;
    try {
      res = await call().timeout(const Duration(seconds: 20));
    } on TimeoutException {
      throw ApiException(0, 'The server took too long to answer.');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(0, 'Cannot reach the server. Check your connection.');
    }

    Map<String, dynamic>? json;
    try {
      final d = jsonDecode(res.body);
      if (d is Map<String, dynamic>) json = d;
    } catch (_) {}

    if (res.statusCode == 401) {
      await clearSession();
      onUnauthorized?.call();
      throw ApiException(401, json?['message']?.toString() ?? 'Your session has ended. Sign in again.');
    }
    if (res.statusCode >= 400 || json == null || json['status'] == 'error') {
      throw ApiException(res.statusCode, json?['message']?.toString() ?? 'Request failed (${res.statusCode}).');
    }
    return json['data'];
  }
}
