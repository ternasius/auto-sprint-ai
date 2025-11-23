import * as ForgeUI from '@forge/ui';
import {
  Fragment,
  Text,
  Strong,
  StatusLozenge,
  Heading,
  useState as useForgeState,
} from '@forge/ui';
import { SprintReport, RiskLevel } from '../types';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

/**
 * IssuePanel Component
 * 
 * Displays condensed sprint metrics in Jira issue panel.
 * Connected to getReportHandler resolver function.
 * 
 * Note: In Forge UI Kit, data is loaded server-side during render.
 * The sprint ID would be extracted from the issue context in the resolver function.
 * 
 * Requirements: 9.4
 */
export const IssuePanel = () => {
  const [report] = useForgeState<SprintReport | null>(null);
  const [loading] = useForgeState<boolean>(false);
  const [error] = useForgeState<string | null>(null);

  // Note: In a full implementation, the resolver function would:
  // 1. Extract sprint ID from issue context
  // 2. Call getReportHandler to fetch cached report
  // 3. Pass report data to this component via props or state

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
  if (loading) {
    return <LoadingState title="Sprint Metrics" message="Loading sprint metrics..." />;
  }

  // Error state
  if (error) {
    return <ErrorState title="Sprint Metrics" message={error} />;
  }

  // No report available
  if (!report) {
    return (
      <Fragment>
        <Heading size="small">Sprint Metrics</Heading>
        <Text>No sprint analysis available.</Text>
      </Fragment>
    );
  }

  // Get top 3 recommendations
  const topRecommendations = report.recommendations.slice(0, 3);

  return (
    <Fragment>
      <Heading size="small">Sprint Metrics</Heading>

      {/* Condensed Sprint Metrics */}
      <Text>
        <Strong>Completion:</Strong> {report.metrics.sprint.completionRate.toFixed(0)}% | 
        <Strong> Velocity:</Strong> {report.metrics.sprint.velocity} pts | 
        <Strong> WIP:</Strong> {report.metrics.sprint.wipCount}
      </Text>

      {/* Current Risk Level */}
      <Text>
        <Strong>Risk Level:</Strong>
      </Text>
      <StatusLozenge
        text={report.riskAssessment.level}
        appearance={getRiskColor(report.riskAssessment.level)}
      />

      {/* Top 3 Recommendations */}
      {topRecommendations.length > 0 ? (
        <Fragment>
          <Text>
            <Strong>Top Recommendations:</Strong>
          </Text>
          {topRecommendations.map((rec) => (
            <Text>
              {rec.priority}. {rec.title}
            </Text>
          ))}
        </Fragment>
      ) : null}

      {/* Link to full analysis */}
      <Text>
        <em>View full analysis in Sprint Analysis page</em>
      </Text>
    </Fragment>
  );
};
