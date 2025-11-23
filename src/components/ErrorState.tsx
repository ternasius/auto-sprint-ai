import * as ForgeUI from '@forge/ui';
import { Fragment, Text, Button, SectionMessage, Heading } from '@forge/ui';

interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryText?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  message, 
  title,
  onRetry,
  retryText = 'Retry'
}) => {
  return (
    <Fragment>
      {title ? <Heading size="medium">{title}</Heading> : null}
      <SectionMessage title="Error" appearance="error">
        <Text>{message}</Text>
      </SectionMessage>
      {onRetry ? (
        <Button text={retryText} onClick={onRetry} />
      ) : null}
    </Fragment>
  );
};
