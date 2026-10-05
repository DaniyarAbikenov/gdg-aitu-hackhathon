class NotFound(Exception):
    pass


class Conflict(Exception):
    pass


class QuotaExceeded(Exception):
    pass


class InvalidDocument(Exception):
    pass


class ProviderUnavailable(Exception):
    pass
