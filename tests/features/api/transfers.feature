@api @transfers
Feature: POST /api/transfers – validation and boundary conditions
  The transfers endpoint must accept valid requests, reject invalid ones with the right status
  code and a clear error, and never fail with a server error (5xx) whatever the input.

  Rule: A valid transfer is created

    Scenario: Valid transfer returns 201 and the created transaction
      When I send a valid transfer request
      Then the response status should be 201
      And the response should contain the created transaction
      And the transfer should appear in GET /api/transactions

  Rule: Missing required fields are rejected with 400

    Scenario Outline: <case> is rejected
      When I send a transfer with "<case>"
      Then the response status should be 400
      And the error code should be "MISSING_FIELDS"
      And the error details should name the fields "<fields>"

      Examples:
        | case                        | fields                          |
        | missing fromAccount         | fromAccount                     |
        | missing toAccount           | toAccount                       |
        | missing amount              | amount                          |
        | missing all required fields | fromAccount, toAccount, amount  |
        | empty object                | fromAccount, toAccount, amount  |
        | empty-string fromAccount    | fromAccount                     |
        | null amount                 | amount                          |

    Scenario Outline: Body that is not a JSON object is rejected – <case>
      When I send the raw body <body> with content type "application/json"
      Then the response status should be 400
      And the error code should be "<code>"

      Examples:
        | case           | body                                    | code           |
        | malformed JSON | '{"fromAccount": "ACC-1001", "amount":' | MALFORMED_JSON |
        | JSON array     | '[1, 2, 3]'                             | INVALID_BODY   |
        | JSON string    | '"transfer"'                            | INVALID_BODY   |
        | JSON null      | 'null'                                  | INVALID_BODY   |

    Scenario: Wrong content type is rejected with 415
      When I send the raw body 'fromAccount=ACC-1001&toAccount=ACC-1002&amount=10' with content type "application/x-www-form-urlencoded"
      Then the response status should be 415
      And the error code should be "UNSUPPORTED_MEDIA_TYPE"

  Rule: Excessive string lengths are handled without server errors

    Scenario Outline: Description of <length> characters returns <status>
      When I send a valid transfer with a description of <length> characters
      Then the response status should be <status>
      And the response should not be a server error

      Examples:
        | length | status |
        | 1      | 201    |
        | 140    | 201    |
        | 141    | 422    |
        | 5000   | 422    |
        | 20000  | 413    |

    Scenario: A 140-character description made of emoji counts characters, not bytes
      When I send a valid transfer with a description of 140 emoji
      Then the response status should be 201

  Rule: Special characters are stored safely or rejected clearly

    Scenario Outline: Printable special characters are accepted and returned exactly – <case>
      When I send a valid transfer with the "<case>" description
      Then the response status should be 201
      And the stored description should be exactly what I sent
      And the transactions table should still be intact

      Examples:
        | case                             |
        | emoji                            |
        | multi-language unicode           |
        | SQL injection attempt            |
        | HTML/script injection attempt    |
        | quotes and backslashes           |
        | zero-width and RTL marks         |
        | percent and underscore wildcards |

    Scenario Outline: Control characters in the description are rejected – <case>
      When I send a valid transfer with the unsafe "<case>" description
      Then the response status should be 422
      And the error details should mention field "description"

      Examples:
        | case                   |
        | null byte              |
        | newline                |
        | tab                    |
        | bell control character |

    Scenario Outline: Invalid account IDs are rejected – <case>
      When I send a transfer from account "<case>"
      Then the response status should be 422
      And the error details should mention field "fromAccount"

      Examples:
        | case                        |
        | SQL injection in account ID |
        | lower-case prefix           |
        | too many digits             |
        | full-width digits           |
        | very long string            |
        | number instead of string    |

  Rule: Amount boundaries

    Scenario Outline: Amount <amount> returns <status>
      When I send a transfer of raw amount <amount> from "ACC-1003" to "ACC-1006"
      Then the response status should be <status>
      And the response should not be a server error

      Examples:
        | amount     | status |
        | 0.01       | 201    |
        | 1000000    | 201    |
        | 1000000.01 | 422    |
        | 0          | 422    |
        | -5         | 422    |
        | 0.001      | 422    |
        | 1e309      | 422    |
        | "100"      | 422    |
        | true       | 422    |

  Rule: Business rules are enforced with 422

    Scenario Outline: <case>
      When I send a transfer of 50 from "<from>" to "<to>"
      Then the response status should be 422
      And the error code should be "<code>"

      Examples:
        | case                         | from     | to       | code               |
        | Same source and destination  | ACC-1001 | ACC-1001 | INVALID_FIELDS     |
        | Unknown destination account  | ACC-1001 | ACC-9999 | ACCOUNT_NOT_FOUND  |
        | Frozen source account        | ACC-1010 | ACC-1001 | ACCOUNT_FROZEN     |
        | Frozen destination account   | ACC-1001 | ACC-1010 | ACCOUNT_FROZEN     |

    Scenario: Transfer larger than the available balance
      When I send a transfer of 999999 from "ACC-1009" to "ACC-1002"
      Then the response status should be 422
      And the error code should be "INSUFFICIENT_FUNDS"
      And no new transaction should have been recorded

    Scenario: Unknown fields are rejected instead of silently ignored
      When I send a valid transfer with an extra field "isAdmin" set to true
      Then the response status should be 422
      And the error details should mention field "isAdmin"
