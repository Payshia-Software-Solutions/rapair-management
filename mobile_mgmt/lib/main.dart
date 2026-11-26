import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'screens/home_shell.dart';
import 'screens/lock_screen.dart';
import 'screens/login_screen.dart';
import 'screens/setup_screen.dart';
import 'services/api_client.dart';
import 'services/app_lock.dart';
import 'services/push_service.dart';
import 'services/session.dart';
import 'services/theme_controller.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Screens start with a gradient header: transparent status bar, light icons.
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
  ));
  await PushService.instance.init();
  await AppLock.instance.load();
  await ThemeController.instance.load();
  final session = Session();
  await session.init();
  runApp(MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: session),
      ChangeNotifierProvider.value(value: AppLock.instance),
      ChangeNotifierProvider.value(value: ThemeController.instance),
    ],
    child: const MgmtApp(),
  ));
}

class MgmtApp extends StatelessWidget {
  const MgmtApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'BizzFlow Manager',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: context.watch<ThemeController>().mode,
        home: const _Root(),
        // Lock sits above the Navigator so it also covers pushed screens, and they survive an unlock.
        builder: (context, child) {
          final locked = context.watch<AppLock>().locked && context.watch<Session>().signedIn;
          return Stack(children: [
            child!,
            if (locked) const Positioned.fill(child: LockScreen()),
          ]);
        },
      );
}

/// Picks setup, login or the app from current state.
class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> with WidgetsBindingObserver {
  bool _editingServer = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) AppLock.instance.onPaused();
    if (state == AppLifecycleState.resumed) AppLock.instance.onResumed();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    if (!s.ready) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!ApiClient.instance.isConfigured || _editingServer) {
      return SetupScreen(onSaved: () => setState(() => _editingServer = false));
    }
    if (!s.signedIn) return LoginScreen(onChangeServer: () => setState(() => _editingServer = true));
    return const HomeShell();
  }
}
