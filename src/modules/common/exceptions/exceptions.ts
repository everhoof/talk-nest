import { HttpException, HttpStatus } from '@nestjs/common';

export type ExceptionMessage = 'en' | 'ru';

export type ExceptionKey =
  | 'POLL_INVALID'
  | 'POLL_ALREADY_VOTED'
  | 'POLL_CLOSED'
  | 'POLL_END_TIME_INVALID'
  | 'POLL_MULTIPLE_VOTES_EXIST'
  | 'UNKNOWN'
  | 'FORBIDDEN'
  | 'USER_DOES_NOT_EXIST'
  | 'USER_DOES_NOT_EXIST_WITH_ID'
  | 'MESSAGE_NOT_FOUND'
  | 'WRONG_MESSAGE_OWNER'
  | 'MESSAGE_NOT_EDITABLE'
  | 'USER_ALREADY_PUNISHED'
  | 'USER_IS_NOT_PUNISHED'
  | 'USERNAME_OCCUPIED'
  | 'EMAIL_OCCUPIED'
  | 'USERNAME_BLACKLISTED'
  | 'EMAIL_BLACKLISTED'
  | 'RESET_PASSWORD_RATE_LIMIT_HIT'
  | 'WRONG_CREDENTIALS'
  | 'NO_FILE_PROVIDED'
  | 'CANNOT_CREATE_EMPTY_MESSAGE'
  | 'YOU_ARE_MUTED'
  | 'YOU_ARE_BANNED'
  | 'IMAGE_CORRUPTED'
  | 'IMAGE_DIMENSIONS_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'SERVER_IS_OVERLOADED'
  | 'CONFIRMATION_IS_INVALID'
  | 'EMAIL_IS_NOT_CONFIRMED'
  | 'EMAIL_ALREADY_CONFIRMED'
  | 'EMAIL_NOT_REGISTERED'
  | 'RATE_LIMIT_REACHED'
  | 'EMAIL_NOT_CONFIRMED';

type Exception = {
  [key in ExceptionKey]: { [key in ExceptionMessage]: string };
};

const exceptions: Exception = {
  POLL_CLOSED: {
    en: 'This poll has ended',
    ru: 'Опрос завершён',
  },
  POLL_END_TIME_INVALID: {
    en: 'The poll end time must be in the future',
    ru: 'Время завершения опроса должно быть в будущем',
  },
  POLL_MULTIPLE_VOTES_EXIST: {
    en: 'Cannot disable multiple answers after participants have selected several options',
    ru: 'Нельзя отключить несколько ответов, пока есть голоса за несколько вариантов',
  },
  POLL_INVALID: {
    en: 'Enter a question and 1–20 different, non-empty options',
    ru: 'Укажите тему и от 1 до 20 разных непустых вариантов ответа',
  },
  POLL_ALREADY_VOTED: {
    en: 'You have already voted in this poll',
    ru: 'Вы уже проголосовали в этом опросе',
  },
  UNKNOWN: {
    en: 'An unknown error occurred',
    ru: 'Произошла неизвестная ошибка',
  },
  FORBIDDEN: {
    en: 'Access to the resource is forbidden',
    ru: 'Доступ к ресурсу запрещён',
  },
  USER_DOES_NOT_EXIST: {
    en: 'User does not exist',
    ru: 'Пользователь не существует',
  },
  USER_DOES_NOT_EXIST_WITH_ID: {
    en: 'User with id %id% does not exist',
    ru: 'Пользователь с id %id% не существует',
  },
  MESSAGE_NOT_FOUND: {
    en: 'Unable to find message',
    ru: 'Не удалось найти сообщение',
  },
  WRONG_MESSAGE_OWNER: {
    en: "That is not you'r message",
    ru: 'Это не ваше сообщение',
  },
  MESSAGE_NOT_EDITABLE: {
    en: 'This message is not editable',
    ru: 'Это не сообщение нельзя редактировать',
  },
  USER_ALREADY_PUNISHED: {
    en: 'User already punished',
    ru: 'Пользователь уже наказан',
  },
  USER_IS_NOT_PUNISHED: {
    en: 'User is not punished',
    ru: 'Пользователь ещё не наказан',
  },
  USERNAME_OCCUPIED: {
    en: 'This username is already occupied',
    ru: 'Это имя пользователя уже занято',
  },
  EMAIL_OCCUPIED: {
    en: 'This email is already occupied',
    ru: 'Этот электронный адрес уже используется',
  },
  USERNAME_BLACKLISTED: {
    en: 'This username has blocked',
    ru: 'Нельзя использовать это имя',
  },
  EMAIL_BLACKLISTED: {
    en: 'This email has blocked',
    ru: 'Этот электронный адрес нельзя использовать',
  },
  RESET_PASSWORD_RATE_LIMIT_HIT: {
    en: 'Password recovery request limit exceeded',
    ru: 'Превышен лимит запросов на восстановление пароля',
  },
  WRONG_CREDENTIALS: {
    en: 'Wrong credentials',
    ru: 'Неверные учётные данные',
  },
  NO_FILE_PROVIDED: {
    en: 'No file provided',
    ru: 'Не предоставлен ни один файл',
  },
  CANNOT_CREATE_EMPTY_MESSAGE: {
    en: 'Cannot create empty message',
    ru: 'Невозможно создать пустое сообщение',
  },
  YOU_ARE_MUTED: {
    en: 'You are muted',
    ru: 'Вы заглушены',
  },
  YOU_ARE_BANNED: {
    en: 'You are muted',
    ru: 'Вы забанены',
  },
  IMAGE_CORRUPTED: {
    en: 'Image corrupted',
    ru: 'Изображение повреждено',
  },
  IMAGE_DIMENSIONS_TOO_LARGE: {
    en: 'Image dimensions too large',
    ru: 'Разрешение изображения слишком большое',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    en: 'Unsupported Media Type',
    ru: 'Неподдерживаемый тип медиа',
  },
  SERVER_IS_OVERLOADED: {
    en: 'Service is overloaded',
    ru: 'Сервер перегружен',
  },
  CONFIRMATION_IS_INVALID: {
    en: 'Confirmation is invalid',
    ru: 'Подтверждение недействительно',
  },
  EMAIL_IS_NOT_CONFIRMED: {
    en: 'E-mail is not confirmed',
    ru: 'E-mail не подтверждён',
  },
  EMAIL_ALREADY_CONFIRMED: {
    en: 'E-mail already confirmed',
    ru: 'E-mail уже подтверждён',
  },
  EMAIL_NOT_REGISTERED: {
    en: 'The user with this email address is not registered',
    ru: 'Пользователь с таким E-mail не зарегистрирован',
  },
  RATE_LIMIT_REACHED: {
    en: 'Not so fast! Try after few seconds.',
    ru: 'Хватит флудить!',
  },
  EMAIL_NOT_CONFIRMED: {
    en: 'E-mail should be confirmed to proceed',
    ru: 'E-mail должен быть подтвержден, чтобы продолжить',
  },
};

function createExceptionMessage(exception: ExceptionKey, lang: ExceptionMessage = 'en', args: string[] = []): string {
  if (exceptions[exception] && exceptions[exception][lang]) {
    const message = exceptions[exception][lang];
    return args.reduce((acc, arg) => acc.replace(/%[a-zA-Z0-9_\-.]+%/, arg), message);
  }
  return 'An unknown error occurred';
}

export class CustomHttpException extends HttpException {
  public readonly exception: ExceptionKey;
  public readonly lang: ExceptionMessage;
  public readonly args: string[];

  constructor(status: number, exception: ExceptionKey, args: string[], lang: ExceptionMessage = 'en') {
    const message = createExceptionMessage(exception, lang, args);
    super(
      {
        statusCode: status,
        error: exception,
        message,
        lang,
        args,
      },
      status,
    );
    this.exception = exception;
    this.lang = lang;
    this.args = args;
  }
}

export class UnauthorizedException extends CustomHttpException {
  constructor(exception: ExceptionKey, ...args: string[]) {
    super(HttpStatus.UNAUTHORIZED, exception, args);
  }
}

export class BadRequestException extends CustomHttpException {
  constructor(exception: ExceptionKey, ...args: string[]) {
    super(HttpStatus.BAD_REQUEST, exception, args);
  }
}

export class InternalServerErrorException extends CustomHttpException {
  constructor(exception: ExceptionKey, ...args: string[]) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, exception, args);
  }
}

export class UnsupportedMediaTypeException extends CustomHttpException {
  constructor(exception: ExceptionKey, ...args: string[]) {
    super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, exception, args);
  }
}

export class ServiceUnavailableException extends CustomHttpException {
  constructor(exception: ExceptionKey, ...args: string[]) {
    super(HttpStatus.SERVICE_UNAVAILABLE, exception, args);
  }
}

export class ForbiddenException extends CustomHttpException {
  constructor(exception: ExceptionKey, ...args: string[]) {
    super(HttpStatus.FORBIDDEN, exception, args);
  }
}
