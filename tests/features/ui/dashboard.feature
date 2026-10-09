@ui @dashboard
Feature: Transaction dashboard
  As a payments operations analyst
  I want a dashboard of transfer activity with filters, trends and anomaly flags
  So that I can monitor volume and spot suspicious round-trip transfers

  Background:
    Given I open the transaction dashboard

  Scenario: Dashboard loads with summary figures that match the underlying data
    Then the "Transaction Dashboard" heading should be visible
    And the summary cards should show:
      | Total volume    |
      | Transactions    |
      | Active accounts |
      | Recent flags    |
    And the summary figures should match my own calculation from the transaction data

  Scenario: Trend chart renders valid, non-zero data that matches the transactions
    Then the daily volume chart should be visible
    And the chart should plot one point per day that has completed transfers
    And every chart value should be a valid number, not negative, with at least one value above zero
    And the chart values should match my own daily totals
    And the chart volumes should add up to the "Total volume" card

  @filters
  Scenario Outline: Filtering by status "<status>" updates the table
    When I filter the transactions by status "<status>"
    Then every visible row should have status "<status>"
    And the result count should equal the number of "<status>" transactions in the data

    Examples:
      | status    |
      | Completed |
      | Pending   |
      | Failed    |

  @filters
  Scenario: Filtering by account shows only transfers involving that account
    When I filter the transactions by account "ACC-1007"
    Then every visible row should involve account "ACC-1007"
    And the result count should equal the number of transactions involving "ACC-1007" in the data

  @filters
  Scenario: Combining account and status filters with sorting by amount
    When I apply these filters:
      | account | ACC-1001            |
      | status  | Completed           |
      | sort    | Amount: high to low |
    Then every visible row should involve account "ACC-1001"
    And every visible row should have status "Completed"
    And the visible rows should be sorted by amount from high to low

  @search
  Scenario: Searching by transaction ID finds exactly that transaction
    When I search the transactions for "TXN-000042"
    Then the table should show exactly 1 row
    And that row should have the ID "TXN-000042"

  @search
  Scenario: A search with no matches shows an empty-state message
    When I search the transactions for "no-such-transaction"
    Then the table should show the message "No transactions match these filters"
    And the result count should read "Showing 0–0 of 0 transactions"

  @pagination
  Scenario: Paging through the results
    Then the page indicator should read "Page 1 of 14"
    When I go to the next page of transactions
    Then the page indicator should read "Page 2 of 14"
    And the result count should read "Showing 11–20 of 131 transactions"
    And the "Previous" button should be enabled

  @flags
  Scenario: Round-trip anomalies are flagged on the dashboard
    Then the flagged round-trip table should list exactly the round trips I detect independently in the data
    And the "Recent flags" card should show the number of flagged round trips
    When I search the transactions for "TXN-000015"
    Then that row should be marked as "Flagged"

  @transfer
  Scenario: Sending a transfer from the dashboard updates the table and the summary
    When I send a transfer of 250.75 from "ACC-1002" to "ACC-1005" with description "Dashboard test transfer"
    Then I should see a success message for the new transfer
    And the newest transaction in the table should be that transfer
    And the "Transactions" card should have increased by 1

  @transfer
  Scenario: A transfer that breaks the rules is rejected with a clear message
    When I send a transfer of 999999 from "ACC-1009" to "ACC-1002" with description "Too much"
    Then I should see the error "Transfer rejected (422): Insufficient funds"
    And the "Transactions" card should not have changed
