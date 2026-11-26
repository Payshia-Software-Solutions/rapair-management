import 'package:flutter/material.dart';

import '../theme.dart';

/// Indigo-violet header with rounded bottom; content sits on top of the gradient.
class GradientHeader extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final double bottomRadius;
  const GradientHeader({super.key, required this.child, this.padding = const EdgeInsets.fromLTRB(20, 12, 20, 24), this.bottomRadius = 32});

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          gradient: AppColors.headerGradient,
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(bottomRadius)),
        ),
        child: Stack(children: [
          // Soft decorative circles
          Positioned(right: -40, top: -30, child: _Blob(160, Colors.white.withValues(alpha: 0.08))),
          Positioned(left: -30, bottom: -50, child: _Blob(130, Colors.white.withValues(alpha: 0.06))),
          SafeArea(bottom: false, child: Padding(padding: padding, child: child)),
        ]),
      );
}

class _Blob extends StatelessWidget {
  final double size;
  final Color color;
  const _Blob(this.size, this.color);
  @override
  Widget build(BuildContext context) =>
      Container(width: size, height: size, decoration: BoxDecoration(shape: BoxShape.circle, color: color));
}

/// White floating card with soft shadow (flat in dark mode).
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: dark
            ? null
            : [
                BoxShadow(color: const Color(0xFF1E1B4B).withValues(alpha: 0.06), blurRadius: 24, offset: const Offset(0, 8)),
                BoxShadow(color: const Color(0xFF1E1B4B).withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  const SectionTitle(this.title, {super.key, this.action, this.onAction});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 12, 10),
      child: Row(children: [
        Expanded(child: Text(title, style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
        if (action != null)
          TextButton(
            onPressed: onAction,
            child: Row(mainAxisSize: MainAxisSize.min, children: [Text(action!), const Icon(Icons.chevron_right, size: 18)]),
          ),
      ]),
    );
  }
}

/// Rounded square with a tinted icon.
class IconBadge extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  const IconBadge(this.icon, this.color, {super.key, this.size = 40});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(size * 0.32)),
        child: Icon(icon, color: color, size: size * 0.52),
      );
}

class InitialsAvatar extends StatelessWidget {
  final String name;
  final double size;
  final bool onGradient;
  const InitialsAvatar(this.name, {super.key, this.size = 36, this.onGradient = false});

  static String initials(String n) {
    final parts = n.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: onGradient ? Colors.white.withValues(alpha: 0.2) : c.withValues(alpha: 0.12),
        border: onGradient ? Border.all(color: Colors.white.withValues(alpha: 0.5), width: 1.5) : null,
      ),
      child: Text(initials(name),
          style: TextStyle(
              color: onGradient ? Colors.white : c, fontWeight: FontWeight.w700, fontSize: size * 0.38)),
    );
  }
}

/// Translucent white pill for use on the gradient header.
class GlassChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  const GlassChip({super.key, required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(30),
        child: InkWell(
          borderRadius: BorderRadius.circular(30),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 16, color: Colors.white),
              const SizedBox(width: 6),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 170),
                child: Text(label,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
              ),
              if (onTap != null) ...[
                const SizedBox(width: 2),
                const Icon(Icons.keyboard_arrow_down, size: 18, color: Colors.white),
              ],
            ]),
          ),
        ),
      );
}

/// Icon + colour per approval document type.
(IconData, Color) docTypeStyle(String type) => switch (type) {
      'purchase_order' => (Icons.shopping_cart_outlined, AppColors.primary),
      'expense' => (Icons.receipt_long_outlined, AppColors.warning),
      'stock_adjustment' => (Icons.tune, AppColors.info),
      'stock_count' => (Icons.inventory_2_outlined, AppColors.info),
      'stock_requisition' => (Icons.local_shipping_outlined, AppColors.violet),
      'cancellation' => (Icons.block, AppColors.danger),
      'discount' => (Icons.percent, AppColors.success),
      _ => (Icons.description_outlined, AppColors.primary),
    };

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action, this.onAction});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(shape: BoxShape.circle, color: t.colorScheme.primary.withValues(alpha: 0.08)),
            child: Icon(icon, size: 40, color: t.colorScheme.primary),
          ),
          const SizedBox(height: 18),
          Text(title, style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700), textAlign: TextAlign.center),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant), textAlign: TextAlign.center),
          ],
          if (action != null) ...[
            const SizedBox(height: 18),
            OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size(160, 46)),
              onPressed: onAction,
              child: Text(action!),
            ),
          ],
        ]),
      ),
    );
  }
}
