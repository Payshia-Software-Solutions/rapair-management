import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../services/session.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onChangeServer;
  const LoginScreen({super.key, required this.onChangeServer});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _hide = true;
  String? _error;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Session>().login(_email.text, _password.text);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Something went wrong. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final api = ApiClient.instance;
    final company = api.workspaceName ?? api.tenantHost ?? 'Your company';
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.headerGradient),
        child: SafeArea(
          bottom: false,
          child: LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight),
                child: IntrinsicHeight(
                  child: Column(children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 36, 24, 32),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 7),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(30),
                              ),
                              child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.business_rounded,
                                        color: Colors.white, size: 16),
                                    const SizedBox(width: 6),
                                    ConstrainedBox(
                                      constraints:
                                          const BoxConstraints(maxWidth: 240),
                                      child: Text(company,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w600)),
                                    ),
                                  ]),
                            ),
                            const SizedBox(height: 28),
                            const Text('Welcome back',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 30,
                                    fontWeight: FontWeight.w800,
                                    height: 1.1)),
                            const SizedBox(height: 8),
                            Text('Sign in with your BizzFlow account',
                                style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    fontSize: 15)),
                          ]),
                    ),
                    Expanded(
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                        decoration: BoxDecoration(
                          color: t.scaffoldBackgroundColor,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(32)),
                        ),
                        child: SafeArea(
                          top: false,
                          child: AutofillGroup(
                            child: Form(
                              key: _form,
                              child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (_error != null) ...[
                                      Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: AppColors.danger
                                              .withValues(alpha: 0.1),
                                          borderRadius:
                                              BorderRadius.circular(14),
                                        ),
                                        child: Row(children: [
                                          const Icon(Icons.error_outline,
                                              color: AppColors.danger,
                                              size: 20),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(_error!,
                                                style: const TextStyle(
                                                    color: AppColors.danger,
                                                    fontWeight:
                                                        FontWeight.w500)),
                                          ),
                                        ]),
                                      ),
                                      const SizedBox(height: 18),
                                    ],
                                    Text('Email',
                                        style: t.textTheme.labelLarge?.copyWith(
                                            fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 8),
                                    TextFormField(
                                      controller: _email,
                                      keyboardType: TextInputType.emailAddress,
                                      autofillHints: const [
                                        AutofillHints.email,
                                        AutofillHints.username
                                      ],
                                      autocorrect: false,
                                      textInputAction: TextInputAction.next,
                                      decoration: const InputDecoration(
                                        hintText: 'you@company.com',
                                        prefixIcon:
                                            Icon(Icons.mail_outline_rounded),
                                      ),
                                      validator: (v) =>
                                          (v == null || v.trim().isEmpty)
                                              ? 'Enter your email'
                                              : null,
                                    ),
                                    const SizedBox(height: 18),
                                    Text('Password',
                                        style: t.textTheme.labelLarge?.copyWith(
                                            fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 8),
                                    TextFormField(
                                      controller: _password,
                                      obscureText: _hide,
                                      autofillHints: const [
                                        AutofillHints.password
                                      ],
                                      onFieldSubmitted: (_) => _submit(),
                                      decoration: InputDecoration(
                                        hintText: '••••••••',
                                        prefixIcon: const Icon(
                                            Icons.lock_outline_rounded),
                                        suffixIcon: IconButton(
                                          icon: Icon(_hide
                                              ? Icons.visibility_outlined
                                              : Icons.visibility_off_outlined),
                                          onPressed: () =>
                                              setState(() => _hide = !_hide),
                                        ),
                                      ),
                                      validator: (v) => (v == null || v.isEmpty)
                                          ? 'Enter your password'
                                          : null,
                                    ),
                                    const SizedBox(height: 28),
                                    FilledButton(
                                      onPressed: _busy ? null : _submit,
                                      child: _busy
                                          ? const SizedBox(
                                              width: 22,
                                              height: 22,
                                              child: CircularProgressIndicator(
                                                  strokeWidth: 2.4,
                                                  color: Colors.white))
                                          : const Text('Sign in'),
                                    ),
                                    const SizedBox(height: 18),
                                    Center(
                                      child: TextButton.icon(
                                        onPressed: _busy
                                            ? null
                                            : widget.onChangeServer,
                                        icon: const Icon(
                                            Icons.swap_horiz_rounded,
                                            size: 18),
                                        label: const Text(
                                            'Not your company? Change'),
                                      ),
                                    ),
                                  ]),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
