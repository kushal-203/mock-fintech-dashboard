@api @transactions
Feature: GET /api/transactions and GET /api/analytics/round-trips

  Scenario: Default listing is paginated and newest first
    When I request the transactions with no parameters
    Then the response status should be 200
    And the response should contain 10 transactions on page 1
    And the transactions should be sorted by "date" in "desc" order

  Scenario Outline: Sorting by <sortBy> <order>
    When I request the transactions with "sortBy=<sortBy>&order=<order>&pageSize=50"
    Then the response status should be 200
    And the transactions should be sorted by "<sortBy>" in "<order>" order

    Examples:
      | sortBy | order |
      | date   | asc   |
      | amount | desc  |
      | amount | asc   |

  Scenario: Filtering by account and status
    When I request the transactions with "account=ACC-1002&status=completed&pageSize=100"
    Then the response status should be 200
    And every transaction should involve "ACC-1002" and have status "completed"
    And the total should equal my own count from the full data set

  Scenario Outline: Invalid query parameter <query> is rejected with 400
    When I request the transactions with "<query>"
    Then the response status should be 400
    And the error code should be "VALIDATION_ERROR"
    And the error details should mention field "<field>"

    Examples:
      | query                 | field    |
      | page=0                | page     |
      | page=abc              | page     |
      | pageSize=101          | pageSize |
      | pageSize=-1           | pageSize |
      | sortBy=balance        | sortBy   |
      | order=sideways        | order    |
      | account=1001          | account  |
      | status=refunded       | status   |
      | unknownParam=1        | unknownParam |
      | page=1&page=2         | page     |

  Scenario: Round-trip analytics match an independent detection over all transactions
    When I request the round-trip analytics
    Then the response status should be 200
    And the round trips should equal the ones I detect independently

  Scenario Outline: Round-trip analytics respect custom criteria (<query>)
    When I request the round-trip analytics with "<query>"
    Then the response status should be 200
    And the round trips should equal the ones I detect independently with "<query>"

    Examples:
      | query                          |
      | windowHours=48&tolerancePct=15 |
      | windowHours=2&tolerancePct=0   |

  Scenario Outline: Invalid round-trip criteria are rejected – <query>
    When I request the round-trip analytics with "<query>"
    Then the response status should be 400
    And the error details should mention field "<field>"

    Examples:
      | query            | field        |
      | windowHours=0    | windowHours  |
      | windowHours=500  | windowHours  |
      | tolerancePct=-1  | tolerancePct |
      | tolerancePct=abc | tolerancePct |
