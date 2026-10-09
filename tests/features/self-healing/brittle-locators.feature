# Uses the intentionally broken locators in tests/self-healing/BrittleDashboardPage.js.
# EXPECTED TO FAIL – run with `npm run test:broken`, then `npm run heal` for the self-healing POC.
@ui @broken-locators
Feature: Brittle locators (self-healing exercise)

  Scenario: Filter failed transactions using brittle locators
    Given I open the dashboard with the brittle page object
    When I choose status "failed" with the brittle status filter
    And I click the brittle Apply button
    Then the brittle result summary should mention "transactions"
    And the brittle trend chart should be visible
    And the brittle Send transfer button should be enabled
