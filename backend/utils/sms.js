import twilio from 'twilio';

let client = null;

/* The last failure reported, so a standing misconfiguration is stated once
   instead of on every transaction. */
let lastFailure = null;

const getTwilioClient = () => {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    if (lastFailure !== 'unset') {
      lastFailure = 'unset';
      console.warn('Twilio credentials not set - SMS is off. Transactions are unaffected.');
    }
    return null;
  }
  client = twilio(sid, token);
  return client;
};

export const sendSMS = async (phoneNumber, message) => {
  try {
    const cli = getTwilioClient();
    if (!cli) return null;
    const result = await cli.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    return result;
  } catch (error) {
    /* One line, not a stack trace, and once per reason rather than once per
       transaction. Bad Twilio credentials are a standing condition: every
       transfer printed eight frames of Twilio internals, which buried the
       lines that mattered and read like the transfer itself had failed. It
       had not -- SMS is best-effort and nothing here is rethrown.

       Twilio 20003 is an authentication failure: the SID, the auth token, or
       both are wrong or missing. */
    const reason = error?.code ? `${error.code} ${error.message}` : error?.message;
    if (reason !== lastFailure) {
      lastFailure = reason;
      console.warn(
        `SMS not sent (${reason}). Further identical failures will be quiet ` +
          'until the reason changes. Transactions are unaffected.'
      );
    }
    return null;
  }
};

export const sendVerificationCode = async (phoneNumber, code) => {
  const message = `Your MoneyPay verification code is: ${code}. Valid for 10 minutes.`;
  return sendSMS(phoneNumber, message);
};

export const sendTransactionSMS = async (phoneNumber, transactionDetails) => {
  const { amount, receiver, transactionId } = transactionDetails;
  const message = `MoneyPay: You have sent SSP ${amount} to ${receiver}. Transaction ID: ${transactionId}`;
  return sendSMS(phoneNumber, message);
};
