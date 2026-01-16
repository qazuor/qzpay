/**
 * Error handling exports
 */

export { QZPayHttpError, HttpStatus, type HttpStatusCode } from './http-error.js';
export {
    mapErrorToHttpStatus,
    isNotFoundError,
    isValidationError,
    isConflictError,
    type ErrorMappingResult
} from './error-mapper.js';
