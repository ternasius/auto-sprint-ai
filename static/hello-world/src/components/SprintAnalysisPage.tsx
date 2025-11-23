import React, { useState, useEffect } from 'react';
import { invoke, view } from '@forge/bridge';
import Button from '@atlaskit/button';
import Select from '@atlaskit/select';
import Lozenge from '@atlaskit/lozenge';
import Spinner from '@atlaskit/spinner';
import SectionMessage from '@atlaskit/section-message';
import { JiraApiService } from '../services/JiraApiService';

interface SprintOption {
  label: string;
  value: string;
}

interface SprintReport {
  summary: string;
  keyFindings: string[];
  riskAssessment: {
    level: 'Low' | 'Medium' | 'High';
    justification: string;
  };
  recommendations: Array<{
    priority: number;
    category: string;
    title: string;
    description: string;
    impact: 'High' | 'Medium' | 'Low';
  }>;
  nextSprintSuggestions?: {
    targetStoryPoints: number;
    tasksToInclude: string[];
    tasksToPostpone: string[];
  };
  metrics: {
    sprint: {
      completionRate: number;
      velocity: number;
      throughput: number;
      wipCount: number;
      carryOverCount: number;
      cycleTime: number;
      leadTime: number;
    };
    pullRequests: {
      averageLatency: number;
      averageTimeToFirstReview: number;
      averageReviewCycles: number;
      averageRevisions: number;
    };
  };
  generatedAt: string;
}

interface SprintAnalysisPageProps {
  context: any;
}

export const SprintAnalysisPage: React.FC<SprintAnalysisPageProps> = ({ context }) => {
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<SprintOption | null>(null);
  const [report, setReport] = useState<SprintReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jiraService] = useState(() => new JiraApiService());

  useEffect(() => {
    loadSprints();
  }, []);

  const loadSprints = async () => {
    try {
      setLoading(true);
      const result = await invoke('getSprintsHandler', {}) as any;
      
      if (result.success) {
        const options = result.sprints.map((s: any) => ({
          label: `${s.name} (${s.state})`,
          value: s.id,
        }));
        setSprints(options);
        
        if (options.length > 0) {
          setSelectedSprint(options[0]);
          await loadReport(options[0].value);
        }
      } else {
        setError(result.error || 'Failed to load sprints');
      }
    } catch (err) {
      setError('Failed to load sprints');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (sprintId: string) => {
    try {
      setAnalyzing(true);
      setError(null);
      
      // Call backend to fetch and analyze sprint data (force refresh to bypass cache)
      const result = await invoke('analyzeSprintHandler', { sprintId, forceRefresh: true }) as any;
      
      if (result.success) {
        setReport(result.report);
      } else {
        setError(result.error || 'Failed to analyze sprint');
      }
    } catch (err) {
      setError(`Failed to analyze sprint: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSprintChange = (option: SprintOption | null) => {
    setSelectedSprint(option);
    if (option) {
      loadReport(option.value);
    }
  };

  const handleRefresh = () => {
    if (selectedSprint) {
      loadReport(selectedSprint.value);
    }
  };

  const getRiskAppearance = (level: string) => {
    switch (level) {
      case 'Low': return 'success';
      case 'Medium': return 'default';
      case 'High': return 'removed';
      default: return 'default';
    }
  };

  if (loading && !report) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Spinner size="large" />
        <p>Loading sprint data...</p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div style={{ padding: '20px' }}>
        <SectionMessage appearance="error" title="Error">
          <p>{error}</p>
          <div style={{ marginTop: '10px' }}>
            <Button onClick={loadSprints}>Retry</Button>
            {' '}
            <Button
              onClick={async () => {
                try {
                  const result = await invoke('testJiraAccess', {}) as any;
                  alert(result.success ? `✅ Success! User: ${result.user}` : `❌ Failed: ${result.error}`);
                } catch (err) {
                  alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }}
              appearance="subtle"
            >
              Test Jira Access
            </Button>
          </div>
        </SectionMessage>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Sprint Analysis</h2>

      <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Select Sprint:
        </label>
        <Select
          options={sprints}
          value={selectedSprint}
          onChange={handleSprintChange}
          placeholder="Choose a sprint"
          isDisabled={analyzing}
        />
      </div>

      <Button
        onClick={handleRefresh}
        isDisabled={analyzing || !selectedSprint}
        appearance="primary"
      >
        {analyzing ? 'Analyzing...' : 'Refresh Analysis'}
      </Button>
      {' '}
      <Button
        onClick={async () => {
          const result = await invoke('testJiraAccess', {}) as any;
          alert(result.success ? `Success! User: ${result.user}` : `Failed: ${result.error}`);
        }}
      >
        Test Jira Access
      </Button>

      {error && report && (
        <div style={{ marginTop: '20px' }}>
          <SectionMessage appearance="warning" title="Warning">
            <p>{error}</p>
          </SectionMessage>
        </div>
      )}

      {analyzing && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Spinner size="large" />
          <p>Analyzing sprint data...</p>
        </div>
      )}

      {report && !analyzing && (
        <div style={{ marginTop: '30px' }}>
          <h3>Summary</h3>
          <p>{report.summary}</p>

          <h3 style={{ marginTop: '20px' }}>Risk Assessment</h3>
          <div style={{ marginBottom: '10px' }}>
            <Lozenge appearance={getRiskAppearance(report.riskAssessment.level) as any}>
              {report.riskAssessment.level}
            </Lozenge>
          </div>
          <p>{report.riskAssessment.justification}</p>

          <h3 style={{ marginTop: '20px' }}>Key Findings</h3>
          {report.keyFindings.length > 0 ? (
            <ul>
              {report.keyFindings.map((finding, index) => (
                <li key={index}>{finding}</li>
              ))}
            </ul>
          ) : (
            <p>No key findings identified.</p>
          )}

          <h3 style={{ marginTop: '20px' }}>Recommendations</h3>
          {report.recommendations.length > 0 ? (
            <div>
              {report.recommendations.map((rec, index) => (
                <div key={index} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f4f5f7', borderRadius: '3px' }}>
                  <div style={{ marginBottom: '5px' }}>
                    <strong>
                      {rec.priority}. {rec.title}
                    </strong>
                    {' '}
                    <Lozenge appearance={rec.impact === 'High' ? 'removed' : rec.impact === 'Medium' ? 'default' : 'success'}>
                      {rec.impact} impact
                    </Lozenge>
                  </div>
                  <p style={{ margin: '5px 0 0 0' }}>{rec.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>No recommendations at this time.</p>
          )}

          {report.nextSprintSuggestions && (
            <>
              <h3 style={{ marginTop: '20px' }}>Next Sprint Suggestions</h3>
              <p><strong>Target Story Points:</strong> {report.nextSprintSuggestions.targetStoryPoints}</p>
              
              {report.nextSprintSuggestions.tasksToInclude.length > 0 && (
                <>
                  <p><strong>Tasks to Include:</strong></p>
                  <ul>
                    {report.nextSprintSuggestions.tasksToInclude.map((task, index) => (
                      <li key={index}>{task}</li>
                    ))}
                  </ul>
                </>
              )}
              
              {report.nextSprintSuggestions.tasksToPostpone.length > 0 && (
                <>
                  <p><strong>Tasks to Postpone:</strong></p>
                  <ul>
                    {report.nextSprintSuggestions.tasksToPostpone.map((task, index) => (
                      <li key={index}>{task}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          <h3 style={{ marginTop: '20px' }}>Sprint Metrics</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Completion Rate:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.sprint.completionRate.toFixed(1)}%</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Velocity:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.sprint.velocity} story points</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Throughput:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.sprint.throughput} issues</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>WIP Count:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.sprint.wipCount}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Carry-over:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.sprint.carryOverCount} tasks</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Cycle Time:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.sprint.cycleTime.toFixed(1)} hours</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Lead Time:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.sprint.leadTime.toFixed(1)} hours</td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: '20px' }}>PR Metrics</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Average PR Latency:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.pullRequests.averageLatency.toFixed(1)} hours</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Time to First Review:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.pullRequests.averageTimeToFirstReview.toFixed(1)} hours</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Average Review Cycles:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.pullRequests.averageReviewCycles.toFixed(1)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '8px' }}><strong>Average Revisions:</strong></td>
                <td style={{ padding: '8px' }}>{report.metrics.pullRequests.averageRevisions.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
            Generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};
