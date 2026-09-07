/// Every named route in the app, in one place so a typo is a compile error
/// rather than a blank screen.
class Routes {
  const Routes._();

  // Auth
  static const welcome = '/welcome';
  static const login = '/login';
  static const register = '/register';
  static const verifyPhone = '/verify-phone';
  static const forgotPassword = '/forgot-password';
  static const resetPassword = '/reset-password';

  // Money
  static const sendMoney = '/send';
  static const receiveQr = '/receive';
  static const scanQr = '/scan';
  static const withdraw = '/withdraw';
  static const buyAirtime = '/airtime';
  static const payBills = '/bills';
  static const transferReceipt = '/receipt';

  // Everything else
  static const history = '/history';
  static const agents = '/agents';
  static const notifications = '/notifications';
  static const profile = '/profile';
  static const editProfile = '/profile/edit';
  static const security = '/security';
  static const help = '/help';
  static const contact = '/contact';
  static const about = '/about';

  // Agent role
  static const agentCashOut = '/agent/cash-out';
  static const agentRequests = '/agent/requests';
  static const pendingApprovals = '/pending-approvals';
}
