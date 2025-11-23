# Auto Sprint AI

Auto Sprint AI is an Atlassian Forge application that analyzes sprint performance in Jira and provides AI-powered recommendations to help teams improve velocity, reduce risk, and optimize sprint outcomes.

## Features

### Sprint Analysis
- Automatic sprint detection - Analyzes any active or completed sprint
- Real-time metrics - Completion rate, velocity, throughput, WIP count
- Performance tracking - Cycle time, lead time, and carry-over analysis

### Risk Assessment
- Intelligent risk scoring - Classifies sprints as Low, Medium, or High risk
- Early warning system - Identifies potential issues before they impact delivery
- Data-driven insights - Risk factors based on actual sprint data

### Smart Recommendations
- Actionable advice - Prioritized recommendations for sprint improvement
- Scope management - Suggestions for story point adjustments
- Workflow optimization - WIP limits and task rebalancing recommendations
- Bottleneck detection - Identifies where work gets stuck

### Key Metrics
- Completion Rate - Percentage of planned work completed
- Velocity - Story points delivered per sprint
- Throughput - Number of issues completed
- Cycle Time - Time from start to completion
- Lead Time - Time from creation to completion
- WIP Count - Current work in progress

## Installation

### For End Users

Click the installation link to add Auto Sprint AI to your Jira site:

[Install Auto Sprint AI](https://developer.atlassian.com/console/install/...)

### For Developers

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/auto-sprint-ai.git
   cd auto-sprint-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd static/hello-world && npm install && cd ../..
   ```

3. **Build the application**
   ```bash
   npm run build
   ```

4. **Deploy to Forge**
   ```bash
   forge deploy
   ```

5. **Install on your Jira site**
   ```bash
   forge install
   ```

## Usage

1. **Navigate to your Jira project**
2. **Click "Sprint Analysis"** in the project sidebar
3. **Select a sprint** from the dropdown
4. **Click "Refresh Analysis"** to generate insights
5. **Review** the summary, risk assessment, and recommendations

## Architecture

### Technology Stack
- **Platform**: Atlassian Forge
- **Backend**: Node.js 20.x, TypeScript
- **Frontend**: React 18, Atlaskit Design System
- **APIs**: Jira REST API v3
- **Storage**: Forge Storage API

### Project Structure
```
auto-sprint-ai/
├── src/
│   ├── backend/           # Forge resolvers and handlers
│   ├── services/          # Business logic
│   │   ├── JiraDataCollector.ts
│   │   ├── MetricsCalculator.ts
│   │   ├── RiskAssessor.ts
│   │   ├── RecommendationGenerator.ts
│   │   └── ReportGenerator.ts
│   └── types/             # TypeScript definitions
├── static/hello-world/    # React frontend
│   └── src/
│       ├── components/    # UI components
│       └── services/      # Frontend services
├── manifest.yml           # Forge app configuration
└── package.json
```

## Development

### Prerequisites
- Node.js 18+ and npm
- Atlassian Forge CLI: `npm install -g @forge/cli`
- Jira Cloud site for testing

### Local Development

1. **Start the development tunnel**
   ```bash
   forge tunnel
   ```

2. **Make changes** to the code

3. **Build and test**
   ```bash
   npm run build
   ```

4. **View logs**
   ```bash
   forge logs
   ```

### Building

```bash
# Build backend and frontend
npm run build

# Build backend only
npm run build:backend

# Build frontend only
npm run build:frontend
```

### Deployment

```bash
# Deploy to development
forge deploy --environment development

# Deploy to production
forge deploy --environment production
```

## Configuration

### Permissions

The app requires the following Jira scopes:
- `read:jira-work` - Read work data
- `read:sprint:jira-software` - Read sprint information
- `read:issue:jira-software` - Read issue data
- `read:project:jira` - Read project information
- `read:issue-details:jira` - Read detailed issue information
- `read:board-scope:jira-software` - Read board data
- `read:issue:jira` - Read issue fields
- `read:jira-user` - Read user information
- `read:field:jira` - Read custom fields
- `read:avatar:jira` - Read user avatars
- `read:issue.changelog:jira` - Read issue history
- `storage:app` - Store cached data

### Environment Variables

No environment variables required - all configuration is in `manifest.yml`.

## How It Works

1. **Data Collection**: Fetches sprint and issue data from Jira using JQL queries
2. **Metrics Calculation**: Computes completion rates, velocity, cycle time, and other KPIs
3. **Risk Assessment**: Analyzes metrics to determine sprint risk level
4. **Recommendation Generation**: Creates prioritized, actionable recommendations
5. **Report Generation**: Formats insights into a user-friendly dashboard

## Troubleshooting

### PR Metrics show 0.0
- PR metrics require Bitbucket integration (not yet implemented)
- Sprint analysis works without PR data
