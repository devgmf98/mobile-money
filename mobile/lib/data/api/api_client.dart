import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../core/config/env.dart';
import '../storage/session_store.dart';

/// A failure with a message fit to show a customer.
///
/// The Express API answers every error as `{ message: "..." }`, and those
/// strings are already written for people ("Insufficient balance", "Recipient
/// not found"). Preferring them over anything we invent keeps one voice across
/// the web app and this one; the generic fallbacks below are only for the cases
/// where no response arrived at all.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.data});

  final String message;
  final int? statusCode;

  /// The decoded body, kept because some failures carry fields the caller acts
  /// on — `needsVerification` on a 403 from sign-in being the important one.
  final Map<String, dynamic>? data;

  bool get isUnauthorised => statusCode == 401;
  bool get isNetworkFailure => statusCode == null;

  @override
  String toString() => message;
}

/// Wraps Dio with the two things every call needs: the bearer token, and
/// errors turned into something a screen can display.
class ApiClient {
  ApiClient({required SessionStore session, Dio? dio})
    : _session = session,
      _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: Env.apiBaseUrl,
              connectTimeout: const Duration(seconds: 20),
              receiveTimeout: const Duration(seconds: 30),
              sendTimeout: const Duration(seconds: 30),
              headers: {'Content-Type': 'application/json'},
              // Non-2xx is handled below rather than thrown raw, so the
              // interceptor can read the body the server sent with it.
              validateStatus: (status) => status != null && status < 500,
            ),
          ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _session.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onResponse: (response, handler) {
          final status = response.statusCode ?? 0;
          if (status >= 200 && status < 300) {
            handler.next(response);
            return;
          }

          // An expired or revoked token has to end the session, or every
          // screen the customer opens next fails the same silent way.
          if (status == 401) {
            unawaited(_onUnauthorised?.call() ?? Future.value());
          }

          handler.reject(
            DioException(
              requestOptions: response.requestOptions,
              response: response,
              type: DioExceptionType.badResponse,
            ),
            true,
          );
        },
      ),
    );

    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(requestBody: false, responseBody: false),
      );
    }
  }

  final Dio _dio;
  final SessionStore _session;
  Future<void> Function()? _onUnauthorised;

  /// Set by [AuthController] so a rejected token signs the app out once,
  /// centrally, instead of every caller having to notice.
  set onUnauthorised(Future<void> Function() handler) =>
      _onUnauthorised = handler;

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    T Function(Object? data)? parse,
  }) => _send<T>(() => _dio.get(path, queryParameters: _pruned(query)), parse);

  Future<T> post<T>(
    String path, {
    Object? body,
    T Function(Object? data)? parse,
  }) => _send<T>(() => _dio.post(path, data: body), parse);

  Future<T> put<T>(
    String path, {
    Object? body,
    T Function(Object? data)? parse,
  }) => _send<T>(() => _dio.put(path, data: body), parse);

  Future<T> patch<T>(
    String path, {
    Object? body,
    T Function(Object? data)? parse,
  }) => _send<T>(() => _dio.patch(path, data: body), parse);

  Future<T> delete<T>(String path, {T Function(Object? data)? parse}) =>
      _send<T>(() => _dio.delete(path), parse);

  Future<T> _send<T>(
    Future<Response<dynamic>> Function() call,
    T Function(Object? data)? parse,
  ) async {
    try {
      final response = await call();
      if (parse != null) return parse(response.data);
      return response.data as T;
    } on DioException catch (error) {
      throw _describe(error);
    }
  }

  /// Query parameters that are null or blank are dropped rather than sent as
  /// the literal string "null", which the server would then try to look up.
  Map<String, dynamic>? _pruned(Map<String, dynamic>? query) {
    if (query == null) return null;
    final kept = <String, dynamic>{};
    query.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.trim().isEmpty) return;
      kept[key] = value;
    });
    return kept.isEmpty ? null : kept;
  }

  ApiException _describe(DioException error) {
    final response = error.response;
    final body = response?.data;

    if (body is Map) {
      final map = body.map((k, v) => MapEntry(k.toString(), v));
      final message = map['message'] ?? map['error'];
      if (message is String && message.trim().isNotEmpty) {
        return ApiException(
          message.trim(),
          statusCode: response?.statusCode,
          data: map,
        );
      }
    }

    final message = switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        'The connection timed out. Check your network and try again.',
      DioExceptionType.connectionError =>
        'Cannot reach MoneyPay right now. Check your internet connection.',
      DioExceptionType.cancel => 'Request cancelled.',
      DioExceptionType.badCertificate =>
        'The secure connection could not be verified.',
      _ => switch (response?.statusCode) {
        401 => 'Your session has expired. Please sign in again.',
        403 => 'You do not have permission to do that.',
        404 => 'We could not find what you were looking for.',
        429 => 'Too many attempts. Please wait a moment and try again.',
        _ => 'Something went wrong. Please try again.',
      },
    };

    return ApiException(message, statusCode: response?.statusCode);
  }
}
