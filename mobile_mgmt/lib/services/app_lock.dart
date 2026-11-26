import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Optional lock: fingerprint / face / device PIN when the app opens or returns
/// after [timeoutMinutes] in the background. Off by default; turned on in Profile.
class AppLock extends ChangeNotifier {
  AppLock._();
  static final AppLock instance = AppLock._();

  static const _kEnabled = 'lock_enabled';
  static const _kTimeout = 'lock_timeout_min';
  static const timeoutChoices = [0, 1, 5, 15, 30];

  final _auth = LocalAuthentication();
  bool enabled = false;
  int timeoutMinutes = 1; // 0 = every time the app leaves the screen
  bool locked = false;
  bool supported = false;
  DateTime? _backgroundAt;
  bool _authenticating = false;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    try {
      supported = await _auth.isDeviceSupported();
    } catch (_) {
      supported = false;
    }
    enabled = supported && (p.getBool(_kEnabled) ?? false);
    timeoutMinutes = p.getInt(_kTimeout) ?? 1;
    locked = enabled; // cold start
  }

  /// Turning on needs one successful unlock, so the user knows it works on this phone.
  Future<bool> setEnabled(bool on) async {
    if (on && !await _authenticate('Confirm to turn on app lock')) return false;
    enabled = on;
    locked = false;
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kEnabled, on);
    notifyListeners();
    return true;
  }

  Future<void> setTimeout(int minutes) async {
    timeoutMinutes = minutes;
    final p = await SharedPreferences.getInstance();
    await p.setInt(_kTimeout, minutes);
    notifyListeners();
  }

  void onPaused() {
    // The system auth dialog itself pauses the app; ignore that.
    if (_authenticating) return;
    _backgroundAt = DateTime.now();
  }

  void onResumed() {
    final at = _backgroundAt;
    _backgroundAt = null;
    if (!enabled || at == null || locked) return;
    if (DateTime.now().difference(at).inMinutes >= timeoutMinutes) {
      locked = true;
      notifyListeners();
    }
  }

  Future<void> unlock() async {
    if (await _authenticate('Unlock BizzFlow Manager')) {
      locked = false;
      notifyListeners();
    }
  }

  /// Called on sign-out: nothing left to protect.
  void reset() {
    locked = false;
    notifyListeners();
  }

  Future<bool> _authenticate(String reason) async {
    if (_authenticating) return false;
    _authenticating = true;
    try {
      // biometricOnly false: falls back to the device PIN / pattern.
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
      );
    } on PlatformException catch (e) {
      debugPrint('App lock auth failed: ${e.code}');
      return false;
    } finally {
      _authenticating = false;
    }
  }
}
