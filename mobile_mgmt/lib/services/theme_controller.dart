import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Light / dark / follow the phone. Saved on the device; changed in Profile > Appearance.
class ThemeController extends ChangeNotifier {
  ThemeController._();
  static final ThemeController instance = ThemeController._();

  static const _k = 'theme_mode';
  ThemeMode mode = ThemeMode.system;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    mode = switch (p.getString(_k)) { 'light' => ThemeMode.light, 'dark' => ThemeMode.dark, _ => ThemeMode.system };
  }

  Future<void> set(ThemeMode m) async {
    mode = m;
    notifyListeners();
    final p = await SharedPreferences.getInstance();
    await p.setString(_k, m.name);
  }
}
