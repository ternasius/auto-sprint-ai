import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import Lozenge from '@atlaskit/lozenge';
import Spinner from '@atlaskit/spinner';
import SectionMessage from '@atlaskit/section-message';

interface SprintReport {
  summary: string;
  riskAssessment: {
    level: 'Low' | 'Medium' | 'High';
    justification: string;
  };
  recommendations: Array<{
    priority: number;
    title: string;
    impact: string;
  }>;
  metrics: {
    sprint: {
      completionRate: number;
      velocity: number;
      wipCount: number;
    };
  };
}

interface IssuePanelProps {
  context: any;
}

export const IssuePanel: React.FC<IssuePanelProps> = ({ context }) => {
  const [report, setReport] = useState<SprintReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get the sprint ID from the issue
      const sprintResult = await invoke('getSprintFromIssueHandler', {}) as any;
      
      if (!sprintResult.success) {
        setError(sprintResult.error || 'Issue is not assigned to a sprint');
        setLoading(false);
        return;
      }

      // Then get the report for that sprint
      const reportResult = await invoke('getReportHandler', { 
        sprintId: sprintResult.sprintId 
      }) as any;
      
      if (reportResult.success) {
        setReport(reportResult.report);
      } else {
        setError('No sprint analysis available. Please run analysis from the Sprint Analysis page first.');
      }
    } catch (err) {
      setError('Failed to load sprint metrics');
      console.error(err);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <Spinner size="medium" />
        <p style={{ marginTop: '8px', fontSize: '14px' }}>Loading sprint metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <SectionMessage appearance="information" title="Sprint Metrics">
          <p>{error}</p>
        </SectionMessage>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ padding: '16px' }}>
        <h4>Sprint Metrics</h4>
        <p>No sprint analysis available.</p>
      </div>
    );
  }

  const topRecommendations = report.recommendations.slice(0, 3);

  return (
    <div style={{ padding: '16px' }}>
      <h4 style={{ marginTop: 0 }}>Sprint Metrics</h4>

      <div style={{ marginBottom: '12px', fontSize: '14px' }}>
        <strong>Completion:</strong> {report.metrics.sprint.completionRate.toFixed(0)}% | {' '}
        <strong>Velocity:</strong> {report.metrics.sprint.velocity} pts | {' '}
        <strong>WIP:</strong> {report.metrics.sprint.wipCount}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <strong style={{ fontSize: '14px' }}>Risk Level:</strong>
        <div style={{ marginTop: '4px' }}>
          <Lozenge appearance={getRiskAppearance(report.riskAssessment.level) as any}>
            {report.riskAssessment.level}
          </Lozenge>
        </div>
      </div>

      {topRecommendations.length > 0 && (
        <div>
          <strong style={{ fontSize: '14px' }}>Top Recommendations:</strong>
          <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '13px' }}>
            {topRecommendations.map((rec, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>
                {rec.priority}. {rec.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ marginTop: '12px', fontSize: '12px', fontStyle: 'italic', color: '#666' }}>
        View full analysis in Sprint Analysis page
      </p>
    </div>
  );
};
