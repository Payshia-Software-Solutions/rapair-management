import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';
import 'approval_service.dart';

/// Background handler must be a top-level function. The system tray shows the
/// notification itself; nothing else to do here.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

/// FCM setup, device registration with /api/device/*, and notification taps.
/// If Firebase is not configured (no google-services.json), push is silently off.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  static const _channel = AndroidNotificationChannel(
    'approvals', // must match PushHelper.php android.notification.channel_id
    'Approvals',
    description: 'New approval requests and decisions',
    importance: Importance.high,
  );

  final _local = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  String? _token;

  /// Emits the `data` map of a tapped notification (e.g. {type: approval, request_id: 12}).
  final taps = StreamController<Map<String, dynamic>>.broadcast();

  /// Data of the notification that launched the app, consumed once by the home screen.
  Map<String, dynamic>? initialTap;

  Future<void> init() async {
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('Push off: Firebase not configured ($e)');
      return;
    }
    _ready = true;
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);

    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);
    await _local.initialize(
      const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: (r) {
        if (r.payload == null) return;
        try {
          taps.add((jsonDecode(r.payload!) as Map).cast<String, dynamic>());
        } catch (_) {}
      },
    );

    // App in foreground: FCM shows nothing, so show it ourselves.
    FirebaseMessaging.onMessage.listen((m) {
      ApprovalService.instance.refreshCount(); // inbox list reloads off the count change
      final n = m.notification;
      if (n == null) return;
      _local.show(
        m.hashCode,
        n.title,
        n.body,
        NotificationDetails(
          android: AndroidNotificationDetails(_channel.id, _channel.name,
              channelDescription: _channel.description, importance: Importance.high, priority: Priority.high),
        ),
        payload: jsonEncode(m.data),
      );
    });

    FirebaseMessaging.onMessageOpenedApp.listen((m) => taps.add(m.data));
    final first = await FirebaseMessaging.instance.getInitialMessage();
    if (first != null) initialTap = first.data;

    FirebaseMessaging.instance.onTokenRefresh.listen((t) {
      _token = t;
      _register(t);
    });
  }

  /// Ask permission (Android 13+), fetch the FCM token and send it to the server. Never throws.
  Future<void> registerCurrentDevice() async {
    if (!_ready || !ApiClient.instance.hasToken) return;
    try {
      await FirebaseMessaging.instance.requestPermission();
      _token = await FirebaseMessaging.instance.getToken();
      if (_token != null) await _register(_token!);
    } catch (e) {
      debugPrint('Push register failed: $e');
    }
  }

  Future<void> _register(String token) async {
    if (!ApiClient.instance.hasToken) return;
    try {
      await ApiClient.instance.post('/device/register', {
        'token': token,
        'app': 'mgmt',
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
      });
    } catch (e) {
      debugPrint('Push register failed: $e');
    }
  }

  /// Call before clearing the session, so the next user on this phone doesn't get our alerts.
  Future<void> unregisterCurrentDevice() async {
    if (!_ready || _token == null || !ApiClient.instance.hasToken) return;
    try {
      await ApiClient.instance.post('/device/unregister', {'token': _token});
    } catch (_) {}
  }
}
