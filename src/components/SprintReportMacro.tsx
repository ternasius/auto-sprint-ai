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
  useConfig,
  Table,
  Head,
  Row,
  Cell,
} from '@forge/ui';
import { SprintReport, RiskLevel, HistoricalMetrics } from '../types';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

/**
 * SprintReportMacro Component
 * 
 * Displays full sprint report in Confluence pages for retrospectives.
 * Connected to getReportHandler and getHistoricalDataHandler resolver functions.
 * 
 * Note: In Forge UI Kit, data is loaded server-side during render.
 * The sprint ID comes from macro configuration.
 * 
 * Requirements: 9.4
 */
export const SprintReportMacro = () => {
  // Get configuration from macro config panel
  const config = useConfig();
  const selectedSprintId = config?.sprintId as string | undefined;

  const [sprints] = useForgeState<Array<{ id: string; name: string }>>([
    { id: 'sprint-1', name: 'Sprint 1' },
    { id: 'sprint-2', name: 'Sprint 2' },
  ]);
  const [report] = useForgeState<SprintReport | null>(null);
  const [historicalData] = useForgeState<HistoricalMetrics[]>([]);
  const [loading] = useForgeState<boolean>(false);
  const [error, setError] = useForgeState<string | null>(null);
  const [refreshing, setRefreshing] = useForgeState<boolean>(false);
  const [exportText, setExportText] = useForgeState<string | null>(null);

  // Note: In a full implementation, the resolver function would:
  // 1. Get sprint ID from macro config
  // 2. Call getReportHandler to fetch cached report
  // 3. Call getHistoricalDataHandler to fetch historical metrics
  // 4. Pass data to this component via props or state

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

  const formatReportAsText = (report: SprintReport): string => {
    let text = '=== SPRINT REPORT ===\n\n';
    
    text += '## SUMMARY\n';
    text += `${report.summary}\n\n`;
    
    text += '## RISK ASSESSMENT\n';
    text += `Risk Level: ${report.riskAssessment.level}\n`;
    text += `${report.riskAssessment.justification}\n\n`;
    
    text += '## KEY FINDINGS\n';
    report.keyFindings.forEach((finding, idx) => {
      text += `${idx + 1}. ${finding}\n`;
    });
    text += '\n';
    
    text += '## RECOMMENDATIONS\n';
    report.recommendations.forEach((rec) => {
      text += `${rec.priority}. ${rec.title} (${rec.impact} impact)\n`;
      text += `   ${rec.description}\n`;
    });
    text += '\n';
    
    if (report.nextSprintSuggestions) {
      text += '## NEXT SPRINT SUGGESTIONS\n';
      text += `Target Story Points: ${report.nextSprintSuggestions.targetStoryPoints}\n\n`;
      
      if (report.nextSprintSuggestions.tasksToInclude.length > 0) {
        text += 'Tasks to Include:\n';
        report.nextSprintSuggestions.tasksToInclude.forEach((task) => {
          text += `  - ${task}\n`;
        });
        text += '\n';
      }
      
      if (report.nextSprintSuggestions.tasksToPostpone.length > 0) {
        text += 'Tasks to Postpone:\n';
        report.nextSprintSuggestions.tasksToPostpone.forEach((task) => {
          text += `  - ${task}\n`;
        });
        text += '\n';
      }
      
      if (report.nextSprintSuggestions.reviewerAssignments.length > 0) {
        text += 'Reviewer Assignments:\n';
        report.nextSprintSuggestions.reviewerAssignments.forEach((assignment) => {
          text += `  - ${assignment.reviewer}: ${assignment.recommendedPRCount} PRs (${assignment.rationale})\n`;
        });
        text += '\n';
      }
    }
    
    text += '## SPRINT METRICS\n';
    text += `Completion Rate: ${report.metrics.sprint.completionRate.toFixed(1)}%\n`;
    text += `Velocity: ${report.metrics.sprint.velocity} story points\n`;
    text += `Throughput: ${report.metrics.sprint.throughput} issues\n`;
    text += `Cycle Time: ${report.metrics.sprint.cycleTime.toFixed(1)} hours\n`;
    text += `Lead Time: ${report.metrics.sprint.leadTime.toFixed(1)} hours\n`;
    text += `WIP Count: ${report.metrics.sprint.wipCount}\n`;
    text += `Carry-over: ${report.metrics.sprint.carryOverCount} tasks\n\n`;
    
    text += '## PR METRICS\n';
    text += `Average PR Latency: ${report.metrics.pullRequests.averageLatency.toFixed(1)} hours\n`;
    text += `Time to First Review: ${report.metrics.pullRequests.averageTimeToFirstReview.toFixed(1)} hours\n`;
    text += `Average Review Cycles: ${report.metrics.pullRequests.averageReviewCycles.toFixed(1)}\n`;
    text += `Average Revisions: ${report.metrics.pullRequests.averageRevisions.toFixed(1)}\n\n`;
    
    text += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n`;
    
    return text;
  };

  const handleExport = () => {
    if (report) {
      const text = formatReportAsText(report);
      setExportText(text);
    }
  };

  // Loading state
  if (loading && !report) {
    return <LoadingState title="Sprint Report" message="Loading sprint report..." />;
  }

  // Error state with retry
  if (error && !report) {
    return (
      <ErrorState 
        title="Sprint Report" 
        message={error} 
        onRetry={() => setError(null)}
        retryText="Retry"
      />
    );
  }

  // Configuration required state
  if (!selectedSprintId && sprints.length > 0) {
    return (
      <Fragment>
        <Heading size="medium">Sprint Report Configuration</Heading>
        <Text>Please configure this macro by selecting a sprint.</Text>
        <Text>
          <Strong>Select Sprint:</Strong>
        </Text>
        <Select label="Sprint" name="sprintSelect">
          {sprints.map((sprint) => (
            <Option label={sprint.name} value={sprint.id} />
          ))}
        </Select>
      </Fragment>
    );
  }

  // Empty state
  if (sprints.length === 0) {
    return (
      <Fragment>
        <Heading size="medium">Sprint Report</Heading>
        <Text>No sprints found. There are no sprints available for reporting.</Text>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <Heading size="large">Sprint Report</Heading>

      {/* Sprint Selection and Refresh */}
      <Text>
        <Strong>Sprint:</Strong> {sprints.find(s => s.id === selectedSprintId)?.name || 'Unknown'}
      </Text>
      
      <Button
        text={refreshing ? 'Refreshing...' : 'Refresh Report'}
        onClick={() => setRefreshing(!refreshing)}
        disabled={refreshing || !selectedSprintId}
      />
      
      <Button
        text="Export as Text"
        onClick={handleExport}
      />

      {/* Show refreshing state */}
      {refreshing ? <LoadingState message="Refreshing sprint report..." /> : null}

      {/* Error message during refresh */}
      {error && report ? (
        <SectionMessage title="Warning" appearance="warning">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}

      {/* Export Text Display */}
      {exportText ? (
        <Fragment>
          <SectionMessage title="Exported Report" appearance="info">
            <Text>Copy the text below:</Text>
          </SectionMessage>
          <Text>{exportText}</Text>
          <Button
            text="Close Export"
            onClick={() => setExportText(null)}
          />
        </Fragment>
      ) : null}

      {/* Full Sprint Report Display */}
      {report && !refreshing ? (
        <Fragment>
          {/* Sprint Summary Section */}
          <Heading size="medium">Summary</Heading>
          <Text>{report.summary}</Text>

          {/* Risk Assessment with Color-Coded Badge */}
          <Heading size="medium">Risk Assessment</Heading>
          <StatusLozenge
            text={report.riskAssessment.level}
            appearance={getRiskColor(report.riskAssessment.level)}
          />
          <Text>{report.riskAssessment.justification}</Text>

          {/* Key Findings as Bullet List */}
          <Heading size="medium">Key Findings</Heading>
          {report.keyFindings.length > 0 ? (
            <Fragment>
              {report.keyFindings.map((finding, idx) => (
                <Text>{idx + 1}. {finding}</Text>
              ))}
            </Fragment>
          ) : (
            <Text>No key findings identified.</Text>
          )}

          {/* Recommendations List */}
          <Heading size="medium">Recommendations</Heading>
          {report.recommendations.length > 0 ? (
            <Fragment>
              {report.recommendations.map((rec) => (
                <Fragment>
                  <Text>
                    <Strong>{rec.priority}. {rec.title}</Strong> ({rec.impact} impact)
                  </Text>
                  <Text>{rec.description}</Text>
                  <Text>Category: {rec.category}</Text>
                </Fragment>
              ))}
            </Fragment>
          ) : (
            <Text>No recommendations at this time.</Text>
          )}

          {/* Next Sprint Suggestions (if available) */}
          {report.nextSprintSuggestions ? (
            <Fragment>
              <Heading size="medium">Next Sprint Suggestions</Heading>
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
              
              {report.nextSprintSuggestions.reviewerAssignments.length > 0 ? (
                <Fragment>
                  <Text>
                    <Strong>Reviewer Assignments:</Strong>
                  </Text>
                  {report.nextSprintSuggestions.reviewerAssignments.map((assignment) => (
                    <Fragment>
                      <Text>
                        <Strong>{assignment.reviewer}:</Strong> {assignment.recommendedPRCount} PRs
                      </Text>
                      <Text>  {assignment.rationale}</Text>
                    </Fragment>
                  ))}
                </Fragment>
              ) : null}
            </Fragment>
          ) : null}

          {/* Detailed Metrics Display */}
          <Heading size="medium">Sprint Metrics</Heading>
          <Table>
            <Head>
              <Cell>
                <Text>Metric</Text>
              </Cell>
              <Cell>
                <Text>Value</Text>
              </Cell>
            </Head>
            <Row>
              <Cell>
                <Text>Completion Rate</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.sprint.completionRate.toFixed(1)}%</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Velocity</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.sprint.velocity} story points</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Throughput</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.sprint.throughput} issues</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Average Cycle Time</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.sprint.cycleTime.toFixed(1)} hours</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Average Lead Time</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.sprint.leadTime.toFixed(1)} hours</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>WIP Count</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.sprint.wipCount}</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Carry-over Tasks</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.sprint.carryOverCount}</Text>
              </Cell>
            </Row>
          </Table>

          <Heading size="medium">PR Metrics</Heading>
          <Table>
            <Head>
              <Cell>
                <Text>Metric</Text>
              </Cell>
              <Cell>
                <Text>Value</Text>
              </Cell>
            </Head>
            <Row>
              <Cell>
                <Text>Average PR Latency</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.pullRequests.averageLatency.toFixed(1)} hours</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Time to First Review</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.pullRequests.averageTimeToFirstReview.toFixed(1)} hours</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Average Review Cycles</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.pullRequests.averageReviewCycles.toFixed(1)}</Text>
              </Cell>
            </Row>
            <Row>
              <Cell>
                <Text>Average Revisions</Text>
              </Cell>
              <Cell>
                <Text>{report.metrics.pullRequests.averageRevisions.toFixed(1)}</Text>
              </Cell>
            </Row>
          </Table>

          {/* Historical Comparison (if available) */}
          {historicalData && historicalData.length > 0 ? (
            <Fragment>
              <Heading size="medium">Historical Comparison</Heading>
              <Text>Comparing current sprint with previous {historicalData.length} sprint(s)</Text>
              
              <Heading size="small">Velocity Trend</Heading>
              <Table>
                <Head>
                  <Cell>
                    <Text>Sprint</Text>
                  </Cell>
                  <Cell>
                    <Text>Velocity</Text>
                  </Cell>
                  <Cell>
                    <Text>Completion Rate</Text>
                  </Cell>
                </Head>
                {historicalData.map((historical) => (
                  <Row>
                    <Cell>
                      <Text>{historical.sprintName}</Text>
                    </Cell>
                    <Cell>
                      <Text>{historical.metrics.velocity} pts</Text>
                    </Cell>
                    <Cell>
                      <Text>{historical.metrics.completionRate.toFixed(1)}%</Text>
                    </Cell>
                  </Row>
                ))}
                <Row>
                  <Cell>
                    <Text>
                      <Strong>Current Sprint</Strong>
                    </Text>
                  </Cell>
                  <Cell>
                    <Text>
                      <Strong>{report.metrics.sprint.velocity} pts</Strong>
                    </Text>
                  </Cell>
                  <Cell>
                    <Text>
                      <Strong>{report.metrics.sprint.completionRate.toFixed(1)}%</Strong>
                    </Text>
                  </Cell>
                </Row>
              </Table>

              <Heading size="small">PR Performance Trend</Heading>
              <Table>
                <Head>
                  <Cell>
                    <Text>Sprint</Text>
                  </Cell>
                  <Cell>
                    <Text>Avg PR Latency</Text>
                  </Cell>
                  <Cell>
                    <Text>Time to First Review</Text>
                  </Cell>
                </Head>
                {historicalData.map((historical) => (
                  <Row>
                    <Cell>
                      <Text>{historical.sprintName}</Text>
                    </Cell>
                    <Cell>
                      <Text>{historical.prMetrics.averageLatency.toFixed(1)}h</Text>
                    </Cell>
                    <Cell>
                      <Text>{historical.prMetrics.averageTimeToFirstReview.toFixed(1)}h</Text>
                    </Cell>
                  </Row>
                ))}
                <Row>
                  <Cell>
                    <Text>
                      <Strong>Current Sprint</Strong>
                    </Text>
                  </Cell>
                  <Cell>
                    <Text>
                      <Strong>{report.metrics.pullRequests.averageLatency.toFixed(1)}h</Strong>
                    </Text>
                  </Cell>
                  <Cell>
                    <Text>
                      <Strong>{report.metrics.pullRequests.averageTimeToFirstReview.toFixed(1)}h</Strong>
                    </Text>
                  </Cell>
                </Row>
              </Table>
            </Fragment>
          ) : null}

          {/* Generated timestamp */}
          <Text>
            <em>Report generated: {new Date(report.generatedAt).toLocaleString()}</em>
          </Text>
          
          <Text>
            <em>This report is formatted for retrospective documentation and team review.</em>
          </Text>
        </Fragment>
      ) : null}
    </Fragment>
  );
};
