import 'parse.dart';

/// The four roles the backend defines. The mobile app serves the first two;
/// admins and sub-admins keep to the web console, so they are recognised only
/// well enough to be turned away with a clear message at sign-in.
enum UserRole {
  user,
  agent,
  admin,
  subAdmin;

  static UserRole parse(Object? raw) {
    switch (raw?.toString()) {
      case 'agent':
        return UserRole.agent;
      case 'admin':
        return UserRole.admin;
      case 'sub-admin':
        return UserRole.subAdmin;
      default:
        return UserRole.user;
    }
  }

  bool get isAgent => this == UserRole.agent;
  bool get isCustomer => this == UserRole.user;
  bool get isStaff => this == UserRole.admin || this == UserRole.subAdmin;

  String get label => switch (this) {
    UserRole.user => 'Personal account',
    UserRole.agent => 'Agent account',
    UserRole.admin => 'Administrator',
    UserRole.subAdmin => 'Sub-administrator',
  };
}

/// The signed-in account.
///
/// `/auth/login` returns a trimmed version of this and `/auth/profile` the full
/// row, so every field beyond the identifiers is optional and merging the two
/// is done with [mergeWith] rather than by replacing one with the other.
class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.balance,
    required this.isVerified,
    required this.isSuspended,
    this.agentId,
    this.adminId,
    this.autoAdminCashout = false,
    this.profileImage,
    this.idNumber,
    this.state,
    this.createdAt,
  });

  final int id;
  final String name;
  final String email;
  final String phone;
  final UserRole role;
  final double balance;
  final bool isVerified;
  final bool isSuspended;

  /// The six-digit ID printed on an agent's badge — customers type it into the
  /// withdraw form. Null for everyone who is not an agent.
  final String? agentId;
  final String? adminId;

  /// Agents only: when on, an admin can collect cash from this account without
  /// asking. When off — the default, and the safe one — every admin cash-out
  /// arrives as a request the agent has to approve.
  final bool autoAdminCashout;

  /// Stored server-side as a base64 data URL in a LONGTEXT column.
  final String? profileImage;
  final String? idNumber;
  final String? state;
  final DateTime? createdAt;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: P.toInt(json['id']),
      name: P.toText(json['name']),
      email: P.toText(json['email']),
      phone: P.toText(json['phone']),
      role: UserRole.parse(json['role']),
      balance: P.toDouble(json['balance']),
      isVerified: P.toBool(json['isVerified'], true),
      isSuspended: P.toBool(json['isSuspended']),
      agentId: P.toTextOrNull(json['agentId']),
      adminId: P.toTextOrNull(json['adminId']),
      autoAdminCashout: P.toBool(json['autoAdminCashout']),
      profileImage: P.toTextOrNull(json['profileImage']),
      idNumber: P.toTextOrNull(json['idNumber']),
      state: P.toTextOrNull(json['state']),
      createdAt: P.toDateOrNull(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'phone': phone,
    'role': switch (role) {
      UserRole.user => 'user',
      UserRole.agent => 'agent',
      UserRole.admin => 'admin',
      UserRole.subAdmin => 'sub-admin',
    },
    'balance': balance,
    'isVerified': isVerified,
    'isSuspended': isSuspended,
    'agentId': agentId,
    'adminId': adminId,
    'autoAdminCashout': autoAdminCashout,
    'profileImage': profileImage,
    'idNumber': idNumber,
    'state': state,
    'createdAt': createdAt?.toIso8601String(),
  };

  AppUser copyWith({
    String? name,
    double? balance,
    bool? isSuspended,
    String? profileImage,
    String? idNumber,
    bool? autoAdminCashout,
  }) {
    return AppUser(
      id: id,
      name: name ?? this.name,
      email: email,
      phone: phone,
      role: role,
      balance: balance ?? this.balance,
      isVerified: isVerified,
      isSuspended: isSuspended ?? this.isSuspended,
      agentId: agentId,
      adminId: adminId,
      autoAdminCashout: autoAdminCashout ?? this.autoAdminCashout,
      profileImage: profileImage ?? this.profileImage,
      idNumber: idNumber ?? this.idNumber,
      state: state,
      createdAt: createdAt,
    );
  }

  /// Folds a fresh `/auth/profile` response over the cached account, keeping
  /// anything the newer payload happened to omit.
  AppUser mergeWith(AppUser fresher) {
    return AppUser(
      id: fresher.id,
      name: fresher.name.isEmpty ? name : fresher.name,
      email: fresher.email.isEmpty ? email : fresher.email,
      phone: fresher.phone.isEmpty ? phone : fresher.phone,
      role: fresher.role,
      balance: fresher.balance,
      isVerified: fresher.isVerified,
      isSuspended: fresher.isSuspended,
      agentId: fresher.agentId ?? agentId,
      adminId: fresher.adminId ?? adminId,
      autoAdminCashout: fresher.autoAdminCashout,
      profileImage: fresher.profileImage ?? profileImage,
      idNumber: fresher.idNumber ?? idNumber,
      state: fresher.state ?? state,
      createdAt: fresher.createdAt ?? createdAt,
    );
  }
}
