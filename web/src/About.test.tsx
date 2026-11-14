import { fireEvent, render, screen } from '@testing-library/react';
import { About } from './About';

test('the About page explains the method, the limits and AI use in both languages', () => {
  const back = vi.fn();
  const { rerender } = render(<About lang="th" onBack={back} />);
  expect(screen.getByTestId('about')).toHaveTextContent('FAO-56');
  expect(screen.getByText('การใช้ AI')).toBeInTheDocument();
  rerender(<About lang="en" onBack={back} />);
  expect(screen.getByText('What the app cannot see')).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Back to the map/));
  expect(back).toHaveBeenCalled();
});
