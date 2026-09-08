import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/profile_image.dart';
import '../../../core/utils/phone.dart';
import '../../../data/api/api_client.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/controls.dart';
import '../../widgets/brand_app_bar.dart';

/// Edit the parts of an account that can be edited.
///
/// Email and phone are fixed: the server keys sign-in on the email and has no
/// endpoint to change either, and a phone number change would need to be
/// re-verified by SMS. Both are shown, greyed, so it is clear they exist rather
/// than appearing to be missing.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _idNumber;

  /// The picked image as a base64 data URL, matching what the server stores.
  String? _newPicture;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthController>().user;
    _name = TextEditingController(text: user?.name ?? '');
    _idNumber = TextEditingController(text: user?.idNumber ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _idNumber.dispose();
    super.dispose();
  }

  /// Ask where the picture should come from, as the web app does with its
  /// "Take Selfie" and "Choose from Files" buttons.
  Future<ImageSource?> _chooseSource() {
    return showModalBottomSheet<ImageSource>(
      context: context,
      // The root navigator, not the shell's nested one. Without this the
      // sheet is mounted inside the shell body, so it stops at the bottom
      // bar - the barrier leaves the bar live and the sheet is clipped
      // short of the screen edge.
      useRootNavigator: true,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.gutter,
                0,
                AppSizes.gutter,
                8,
              ),
              child: Row(
                children: [
                  Text(
                    'Profile picture',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
            ),
            SettingsRow(
              icon: Icons.photo_camera_rounded,
              label: 'Take a selfie',
              subtitle: 'Use the front camera',
              onTap: () => Navigator.of(sheetContext).pop(ImageSource.camera),
            ),
            SettingsRow(
              icon: Icons.photo_library_rounded,
              label: 'Choose from gallery',
              subtitle: 'Pick a photo already on this phone',
              onTap: () => Navigator.of(sheetContext).pop(ImageSource.gallery),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _pickPicture() async {
    final source = await _chooseSource();
    if (source == null || !mounted) return;

    try {
      // Compressed on capture. The picture is stored as a string in a database
      // column, so its encoded length is what matters - see ProfileImage.
      final file = await ImagePicker().pickImage(
        source: source,
        maxWidth: ProfileImage.captureSize.toDouble(),
        maxHeight: ProfileImage.captureSize.toDouble(),
        imageQuality: ProfileImage.captureQuality,
        // A profile picture taken on the spot is a selfie; opening the rear
        // camera for it would be the wrong way round.
        preferredCameraDevice: CameraDevice.front,
      );
      if (file == null) return;

      final encoded = ProfileImage.encode(await file.readAsBytes());
      if (!mounted) return;

      if (ProfileImage.isTooLarge(encoded)) {
        AppSnack.error(
          context,
          'That picture is too large (${ProfileImage.describeSize(encoded)}). '
          'Please choose a smaller one.',
        );
        return;
      }

      setState(() => _newPicture = encoded);
    } catch (_) {
      if (mounted) {
        AppSnack.error(
          context,
          source == ImageSource.camera
              ? 'Could not open the camera. Check the app has permission.'
              : 'Could not open that image.',
        );
      }
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await context.read<AuthController>().updateProfile(
        name: _name.text,
        idNumber: _idNumber.text,
        profileImage: _newPicture,
      );
      if (!mounted) return;
      AppSnack.success(context, 'Profile updated.');
      Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  ImageProvider? get _preview => ProfileImage.decode(
    _newPicture ?? context.read<AuthController>().user?.profileImage,
  );

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: const BrandAppBar(),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.gutter,
              16,
              AppSizes.gutter,
              32,
            ),
            children: [
              Center(
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    UserAvatar(
                      initials: Fmt.initials(user.name),
                      imageProvider: _preview,
                      size: 96,
                    ),
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: GestureDetector(
                        onTap: _pickPicture,
                        child: Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppColors.background,
                              width: 2.5,
                            ),
                          ),
                          child: const Icon(
                            Icons.photo_camera_rounded,
                            size: 15,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Center(
                child: TextButton(
                  onPressed: _pickPicture,
                  child: const Text('Change photo'),
                ),
              ),
              const SizedBox(height: 18),

              if (_error != null) ...[
                Notice(message: _error!),
                const SizedBox(height: 18),
              ],

              LabelledField(
                label: 'Full Name',
                child: TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(hintText: 'Your full name'),
                  validator: (value) => (value ?? '').trim().length < 2
                      ? 'Enter your full name'
                      : null,
                ),
              ),
              const SizedBox(height: 18),

              LabelledField(
                label: 'National ID Number',
                child: TextFormField(
                  controller: _idNumber,
                  decoration: const InputDecoration(
                    hintText: 'Optional',
                    prefixIcon: Icon(Icons.badge_outlined, size: 19),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              LabelledField(
                label: 'Email Address',
                child: TextFormField(
                  initialValue: user.email,
                  enabled: false,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.mail_outline_rounded, size: 19),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              LabelledField(
                label: 'Phone Number',
                child: TextFormField(
                  initialValue: Phone.pretty(user.phone),
                  enabled: false,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.phone_outlined, size: 19),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Contact customer care to change your email or phone number.',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),

              const SizedBox(height: 28),
              PrimaryButton(
                label: 'Save Changes',
                busy: _busy,
                onPressed: _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
