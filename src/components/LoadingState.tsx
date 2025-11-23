import * as ForgeUI from '@forge/ui';
import { Fragment, Text, Heading } from '@forge/ui';

interface LoadingStateProps {
  message?: string;
  title?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading...', 
  title 
}) => {
  return (
    <Fragment>
      {title ? <Heading size="medium">{title}</Heading> : null}
      <Text>⏳ {message}</Text>
    </Fragment>
  );
};
