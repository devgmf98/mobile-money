import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'parse.dart';

enum NotificationKind {
  transaction,
  system,
  alert,
  offer,
  withdrawalRequest;

  static NotificationKind parse(Object? raw) => switch (raw?.toString()) {
    'transaction' => NotificationKind.transaction,
    'alert' => NotificationKind.alert,
    'offer' => NotificationKind.offer,
    'withdrawal_request' => NotificationKind.withdrawalRequest,
    _ => NotificationKind.system,
  };

  /// What kind of notification this is, for a reader rather than a switch.
  String get label => switch (this) {
    NotificationKind.transaction => 'Transaction',
    NotificationKind.alert => 'Alert',
    NotificationKind.offer => 'Offer',
    NotificationKind.withdrawalRequest => 'Cash-out request',
    NotificationKind.system => 'System',
  };

  IconData get icon => switch (this) {
    NotificationKind.transaction => Icons.swap_horiz_rounded,
    NotificationKind.alert => Icons.warning_amber_rounded,
    NotificationKind.offer => Icons.local_offer_outlined,
    NotificationKind.withdrawalRequest => Icons.pending_actions_rounded,
    NotificationKind.system => Icons.notifications_none_rounded,
  };

  Color get color => switch (this) {
    NotificationKind.transaction => AppColors.primary,
    NotificationKind.alert => AppColors.danger,
    NotificationKind.offer => AppColors.success,
    NotificationKind.withdrawalRequest => AppColors.warning,
    NotificationKind.system => AppColors.info,
  };

  Color get tint => switch (this) {
    NotificationKind.transaction => AppColors.primaryTint,
    NotificationKind.alert => AppColors.dangerTint,
    NotificationKind.offer => AppColors.successTint,
    NotificationKind.withdrawalRequest => AppColors.warningTint,
    NotificationKind.system => AppColors.infoTint,
  };
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.kind,
    required this.isRead,
    required this.createdAt,
    this.relatedTransactionId,
  });

  final int id;
  final String title;
  final String message;
  final NotificationKind kind;
  final bool isRead;
  final DateTime createdAt;
  final int? relatedTransactionId;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: P.toInt(json['id']),
      title: P.toText(json['title'], 'Notification'),
      message: P.toText(json['message']),
      kind: NotificationKind.parse(json['type']),
      isRead: P.toBool(json['isRead']),
      createdAt: P.toDate(json['createdAt']),
      relatedTransactionId: P.toIntOrNull(json['relatedTransactionId']),
    );
  }

  /// Socket payloads are hand-built by the server and use slightly different
  /// keys per emit site (`recipient` vs `recipientId`, no id at all on some).
  /// They are only ever shown, never acted on by id, so a synthetic id is fine.
  factory AppNotification.fromSocket(Map<String, dynamic> json) {
    return AppNotification(
      id: P.toInt(json['id'], -DateTime.now().millisecondsSinceEpoch % 100000),
      title: P.toText(json['title'], 'Notification'),
      message: P.toText(json['message']),
      kind: NotificationKind.parse(json['type']),
      isRead: false,
      createdAt: DateTime.now(),
      relatedTransactionId: P.toIntOrNull(
        json['relatedTransactionId'] ?? json['relatedTransaction'],
      ),
    );
  }

  AppNotification markRead() => AppNotification(
    id: id,
    title: title,
    message: message,
    kind: kind,
    isRead: true,
    createdAt: createdAt,
    relatedTransactionId: relatedTransactionId,
  );
}
