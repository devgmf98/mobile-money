import 'package:flutter/material.dart';

import 'api_client.dart';

/// Airtime, bill payment and the agent directory.
///
/// These three appear in the product design but have no endpoint behind them —
/// there is no airtime route, no biller route and no agent-listing route in the
/// Express API. Rather than fake them, the screens are built and the calls all
/// land here, where they fail loudly with a message that says so.
///
/// Wiring them up later is a change to this file alone: replace each
/// [_notWired] with a real `_client` call and the screens work unchanged.
class ServicesApi {
  const ServicesApi(this._client);

  // Held so the real implementations have it to hand; unused until then.
  // ignore: unused_field
  final ApiClient _client;

  static const String unavailableMessage =
      'This service is not connected yet. It will be available in a future '
      'update.';

  Never _notWired() => throw const ApiException(unavailableMessage);

  /// TODO(backend): POST /api/services/airtime { network, phone, amount }
  Future<void> buyAirtime({
    required String network,
    required String phone,
    required double amount,
  }) async => _notWired();

  /// TODO(backend): POST /api/services/bills { biller, account, amount }
  Future<void> payBill({
    required String biller,
    required String account,
    required double amount,
  }) async => _notWired();

  /// TODO(backend): GET /api/agents?lat=&lng= — a directory of agents with
  /// their trading location, for the map and the nearest-first list.
  Future<List<AgentDirectoryEntry>> nearbyAgents() async => _notWired();
}

/// A mobile network an airtime top-up can be bought on.
class MobileNetwork {
  const MobileNetwork({
    required this.id,
    required this.name,
    required this.color,
  });

  final String id;
  final String name;
  final Color color;

  /// The three networks in the design. Presentation only — no top-up is
  /// actually routed to any of them yet.
  static const List<MobileNetwork> all = [
    MobileNetwork(id: 'zain', name: 'Zain', color: Color(0xFF16B364)),
    MobileNetwork(id: 'mtn', name: 'MTN', color: Color(0xFFF7B500)),
    MobileNetwork(id: 'smile', name: 'Smile', color: Color(0xFF34D3B7)),
  ];
}

/// A category of bill, as listed on the Pay Bills screen.
class BillerCategory {
  const BillerCategory({
    required this.id,
    required this.name,
    required this.icon,
    required this.color,
  });

  final String id;
  final String name;
  final IconData icon;
  final Color color;

  static const List<BillerCategory> all = [
    BillerCategory(
      id: 'electricity',
      name: 'Electricity',
      icon: Icons.bolt_rounded,
      color: Color(0xFFF7B500),
    ),
    BillerCategory(
      id: 'water',
      name: 'Water',
      icon: Icons.water_drop_rounded,
      color: Color(0xFF3B82F6),
    ),
    BillerCategory(
      id: 'internet',
      name: 'Internet',
      icon: Icons.wifi_rounded,
      color: Color(0xFF34D3B7),
    ),
    BillerCategory(
      id: 'tv',
      name: 'TV Subscription',
      icon: Icons.tv_rounded,
      color: Color(0xFF8B5CF6),
    ),
    BillerCategory(
      id: 'school',
      name: 'School Fees',
      icon: Icons.school_rounded,
      color: Color(0xFFE5484D),
    ),
    BillerCategory(
      id: 'other',
      name: 'Other Bills',
      icon: Icons.more_horiz_rounded,
      color: Color(0xFF6B7089),
    ),
  ];
}

/// One agent on the locator screen, for when the directory endpoint exists.
class AgentDirectoryEntry {
  const AgentDirectoryEntry({
    required this.agentId,
    required this.name,
    required this.locationName,
    required this.phone,
    this.distanceKm,
  });

  final String agentId;
  final String name;
  final String locationName;
  final String phone;
  final double? distanceKm;
}
