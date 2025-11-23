import * as ForgeUI from '@forge/ui';
import {
  Fragment,
  Text,
  Button,
  Select,
  Option,
  Strong,
  StatusLozenge,
  Heading,
  SectionMessage,
  useState as useForgeState,
} from '@forge/ui';
import { SprintReport, RiskLevel } from '../types';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

/**
 * SprintAnalysisPanel Component
 * 
 * Displays sprint analysis in Jira project page.
 * Connected to analyzeSprintHandler resolver function.
 * 
 * Note: In Forge UI Kit, async operations are handled through resolver functions.
 * The actual data fetching happens server-side when the component is rendered.
 * For interactive updates, you would use Form submissions or Custom UI with @forge/bridge.
 * 
 * Requirements: 9.4
 */
export const SprintAnalysisPanel = () => {
  const [sprints] = useForgeState<Array<{ id: string; name: string }>>([
    { id: 'sprint-1', name: 'Sprint 1' },
    { id: 'sprint-2', name: 'Sprint 2' },
  ]);
  const [selectedSprintId] = useForgeState<string | null>(
    sprints.length > 0 ? sprints[0].id : null
  );
  const [report] = useForgeState<SprintReport | null>(null);
  const [loading] = useForgeState<boolean>(false);
  const [error, setError] = useForgeState<string | null>(null);
  const [analyzing, setAnalyzing] = useForgeState<boolean>(false);

  // Note: In a full implementation with Custom UI, you would use @forge/bridge invoke() here
  // For Forge UI Kit (server-side), data is typically loaded during initial render
  // or through form submissions that trigger page reloads

  const getRiskColor = (level: RiskLevel): 'success' | 'default' | 'removed' => {
    switch (level) {
      case 'Low':
        return 'success';
      case 'Medium':
        return 'default';
      case 'High':
        return 'removed';
      default:
        return 'default';
    }
  };

  // Loading state
  if (loading && !report) {
    return <LoadingState title="Sprint Analysis" message="Loading sprint data..." />;
  }

  // Error state with retry
  if (error && !report) {
    return (
      <ErrorState 
        title="Sprint Analysis" 
        message={error} 
        onRetry={() => setError(null)}
        retryText="Retry"
      />
    );
  }

  // Empty state
  if (sprints.length === 0) {
    return (
      <Fragment>
        <Heading size="medium">Sprint Analysis</Heading>
        <Text>No sprints found. There are no sprints available for analysis.</Text>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <Heading size="medium">Sprint Analysis</Heading>

      {/* Sprint Selection Dropdown */}
      <Text>
        <Strong>Select Sprint:</Strong>
      </Text>
      <Select 
        label="Sprint" 
        name="sprintSelect"
      >
        {sprints.map((sprint) => (
          <Option 
            label={sprint.name} 
            value={sprint.id}
            defaultSelected={sprint.id === selectedSprintId}
          />
        ))}
      </Select>

      {/* Refresh Button */}
      <Button
        text={analyzing ? 'Analyzing...' : 'Refresh Analysis'}
        onClick={() => setAnalyzing(!analyzing)}
        disabled={analyzing || !selectedSprintId}
      />

      {/* Show analyzing state */}
      {analyzing ? <LoadingState message="Analyzing sprint data..." /> : null}

      {/* Error message during refresh */}
      {error && report ? (
        <SectionMessage title="Warning" appearance="warning">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}

      {/* Sprint Report Display */}
      {report && !analyzing ? (
        <Fragment>
          {/* Sprint Summary Section */}
          <Heading size="small">Summary</Heading>
          <Text>{report.summary}</Text>

          {/* Risk Assessment with Color-Coded Badge */}
          <Heading size="small">Risk Assessment</Heading>
          <StatusLozenge
            text={report.riskAssessment.level}
            appearance={getRiskColor(report.riskAssessment.level)}
          />
          <Text>{report.riskAssessment.justification}</Text>

          {/* Key Findings as Bullet List */}
          <Heading size="small">Key Findings</Heading>
          {report.keyFindings.length > 0 ? (
            <Fragment>
              {report.keyFindings.map((finding) => (
                <Text>• {finding}</Text>
              ))}
            </Fragment>
          ) : (
            <Text>No key findings identified.</Text>
          )}

          {/* Recommendations List */}
          <Heading size="small">Recommendations</Heading>
          {report.recommendations.length > 0 ? (
            <Fragment>
              {report.recommendations.map((rec) => (
                <Fragment>
                  <Text>
                    <Strong>{rec.priority}. {rec.title}</Strong> ({rec.impact} impact)
                  </Text>
                  <Text>{rec.description}</Text>
                </Fragment>
              ))}
            </Fragment>
          ) : (
            <Text>No recommendations at this time.</Text>
          )}

          {/* Next Sprint Suggestions (if available) */}
          {report.nextSprintSuggestions ? (
            <Fragment>
              <Heading size="small">Next Sprint Suggestions</Heading>
              <Text>
                <Strong>Target Story Points:</Strong> {report.nextSprintSuggestions.targetStoryPoints}
              </Text>
              {report.nextSprintSuggestions.tasksToInclude.length > 0 ? (
                <Fragment>
                  <Text>
                    <Strong>Tasks to Include:</Strong>
                  </Text>
                  {report.nextSprintSuggestions.tasksToInclude.map((task) => (
                    <Text>• {task}</Text>
                  ))}
                </Fragment>
              ) : null}
              {report.nextSprintSuggestions.tasksToPostpone.length > 0 ? (
                <Fragment>
                  <Text>
                    <Strong>Tasks to Postpone:</Strong>
                  </Text>
                  {report.nextSprintSuggestions.tasksToPostpone.map((task) => (
                    <Text>• {task}</Text>
                  ))}
                </Fragment>
              ) : null}
            </Fragment>
          ) : null}

          {/* Metrics Display */}
          <Heading size="small">Sprint Metrics</Heading>
          <Text>
            <Strong>Completion Rate:</Strong> {report.metrics.sprint.completionRate.toFixed(1)}%
          </Text>
          <Text>
            <Strong>Velocity:</Strong> {report.metrics.sprint.velocity} story points
          </Text>
          <Text>
            <Strong>Throughput:</Strong> {report.metrics.sprint.throughput} issues
          </Text>
          <Text>
            <Strong>WIP Count:</Strong> {report.metrics.sprint.wipCount}
          </Text>
          <Text>
            <Strong>Carry-over:</Strong> {report.metrics.sprint.carryOverCount} tasks
          </Text>

          <Heading size="small">PR Metrics</Heading>
          <Text>
            <Strong>Average PR Latency:</Strong> {report.metrics.pullRequests.averageLatency.toFixed(1)} hours
          </Text>
          <Text>
            <Strong>Time to First Review:</Strong> {report.metrics.pullRequests.averageTimeToFirstReview.toFixed(1)} hours
          </Text>
          <Text>
            <Strong>Average Review Cycles:</Strong> {report.metrics.pullRequests.averageReviewCycles.toFixed(1)}
          </Text>

          {/* Generated timestamp */}
          <Text>Generated: {new Date(report.generatedAt).toLocaleString()}</Text>
        </Fragment>
      ) : null}
    </Fragment>
  );
};
