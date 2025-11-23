# Privacy Policy for Auto Sprint AI

**Last Updated:** November 23, 2025

## Overview

Auto Sprint AI ("the App") is a Jira Cloud app built on the Atlassian Forge platform that provides sprint analysis, metrics calculation, and AI-powered predictions for agile teams. This privacy policy explains how the App collects, uses, stores, and protects your data.

## Data Controller

This App is developed and maintained as an independent project. For privacy inquiries, please contact the developer by submitting an issue through GitHub.

## What Data We Collect

The App collects and processes the following data from your Jira instance:

### Sprint Data
- Sprint ID, name, state (active/closed/future)
- Sprint start and end dates
- Sprint goals

### Issue Data
- Issue ID, key, and summary
- Issue status and status change history
- Story point estimates
- Assignee names
- Issue creation dates
- Issue changelog (for tracking status transitions)

### User Data
- Display names of users assigned to issues
- Display names of users who made status changes (from changelog)

### Project Data
- Project keys and names (for context)

## How We Use Your Data

The App uses the collected data solely for the following purposes:

1. **Sprint Analysis**: Calculate sprint metrics including velocity, completion rates, and cycle times
2. **Predictions**: Generate AI-powered predictions for sprint completion and risk assessment
3. **Recommendations**: Provide actionable recommendations to improve sprint performance
4. **Historical Trends**: Analyze historical sprint data to identify patterns and trends
5. **Report Generation**: Create comprehensive sprint reports with visualizations

## Data Storage

### Forge Storage
All data is stored using **Atlassian Forge Storage API**, which means:
- Data is stored within Atlassian's secure infrastructure
- Data never leaves Atlassian's cloud environment
- Storage is encrypted at rest and in transit
- Data is isolated per Jira instance (no cross-tenant data access)

### Cached Data
The App caches the following data to improve performance:

| Data Type | Cache Duration | Purpose |
|-----------|----------------|---------|
| Sprint data and issues | 15 minutes | Reduce API calls and improve response time |
| Pull request data | 10 minutes | Optimize development metrics calculation |
| Generated reports | 1 hour | Serve repeated requests efficiently |
| Historical metrics | 24 hours | Enable trend analysis without repeated calculations |

Cached data is automatically expired and can be manually invalidated when sprint data is updated.

## Data Sharing and Third Parties

**We do NOT share your data with any third parties.**

The App:
- ✅ Runs entirely on Atlassian Forge infrastructure
- ✅ Uses only Atlassian Jira APIs
- ✅ Stores data only in Forge Storage
- ❌ Does NOT send data to external servers
- ❌ Does NOT use external analytics services
- ❌ Does NOT share data with advertisers
- ❌ Does NOT sell your data

## Data Security

### Security Measures
- **Authentication**: Uses Forge's built-in authentication (`api.asUser()`)
- **Authorization**: Respects Jira's permission model - users can only access data they have permission to view
- **Encryption**: All data is encrypted in transit (HTTPS) and at rest (Forge Storage)
- **Isolation**: Data is isolated per Jira instance with no cross-tenant access
- **No External Calls**: App makes no external network requests

### Permissions Required
The App requires the following Jira permissions to function:

```
- read:jira-work
- read:sprint:jira-software
- read:issue:jira-software
- read:project:jira
- read:issue-details:jira
- read:board-scope:jira-software
- read:issue:jira
- read:jira-user
- read:field:jira
- read:avatar:jira
- read:issue.changelog:jira
- read:project.property:jira
- storage:app
```

These permissions are **read-only** (except for app storage) and are used solely to fetch sprint and issue data for analysis.

## Data Retention

### Active Data
- Sprint data and metrics are retained as long as the App is installed
- Cached data expires automatically based on TTL (see table above)

### Data Deletion
When you uninstall the App:
- All data stored in Forge Storage is automatically deleted by Atlassian
- No data persists after uninstallation
- No backups are maintained outside of Forge Storage

### Manual Data Deletion
You can request data deletion at any time by:
1. Uninstalling the App from your Jira instance
2. Contacting the developer through the Marketplace listing

## User Rights

Under GDPR and other privacy regulations, you have the right to:

- **Access**: View what data the App has collected about you
- **Rectification**: Request correction of inaccurate data
- **Erasure**: Request deletion of your data (by uninstalling the App)
- **Portability**: Request a copy of your data in a structured format
- **Objection**: Object to data processing (by not using the App)

To exercise these rights, please contact the developer through the Atlassian Marketplace listing.

## Compliance

### GDPR Compliance
The App is designed to comply with the General Data Protection Regulation (GDPR):
- Data is processed lawfully and transparently
- Data collection is limited to what's necessary for the App's functionality
- Data is stored securely within the EU (via Atlassian's infrastructure)
- Users have control over their data

### Atlassian Cloud Security
The App benefits from Atlassian's enterprise-grade security:
- SOC 2 Type II certified
- ISO 27001 certified
- GDPR compliant
- Regular security audits

## Children's Privacy

The App is not intended for use by children under 16 years of age. We do not knowingly collect personal information from children.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the App after changes constitutes acceptance of the updated policy.

## Contact Information

For privacy-related questions or concerns:
- Contact the developer through the [Atlassian Marketplace listing](https://marketplace.atlassian.com/)
- Submit issues on the project's GitHub repository (if available)

## Transparency

This App is built on Atlassian Forge and qualifies for the **"Runs on Atlassian"** program, which means:
- All processing happens within Atlassian's infrastructure
- No external servers or services are used
- Enhanced security and privacy guarantees
- Full compliance with Atlassian's security standards

## Technical Details

For developers and security teams who want to verify our privacy claims:

### Data Flow
1. User interacts with App UI in Jira
2. App calls Forge resolvers (backend functions)
3. Resolvers call Jira REST API v3 using `api.asUser()`
4. Data is processed in-memory within Forge runtime
5. Results are cached in Forge Storage
6. Results are displayed to user in Jira UI

### No External Dependencies
The App uses:
- Atlassian Forge SDK
- Jira REST API v3
- Forge Storage API
- React and Atlaskit (Atlassian's UI library)

The App does NOT use:
- External databases
- External APIs
- Third-party analytics
- External logging services
- CDNs for user data

### Open Source
The App's source code may be available for review on GitHub, allowing you to verify these privacy claims independently.

---

**By using Auto Sprint AI, you acknowledge that you have read and understood this privacy policy.**
