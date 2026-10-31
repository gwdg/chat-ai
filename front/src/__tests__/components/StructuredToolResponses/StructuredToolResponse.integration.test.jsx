import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StructuredToolResponse from '../../../src/components/StructuredToolResponses/StructuredToolResponse';

// Mock Redux
vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: () => ({})
}));

describe('StructuredToolResponse - Lock Feature', () => {
  const mockResponse = {
    id: 'test-id',
    type: 'structured_tool_response',
    version: '1.0',
    tool_id: 'test_tool',
    status: 'in_progress',
    locked: false,
    data: {
      schema: {
        title: 'Test Form',
        description: 'Test Description',
        layout: 'vertical',
        fields: [
          {
            name: 'testField',
            label: 'Test Field',
            type: 'text',
            required: true,
            placeholder: 'Enter value'
          },
          {
            name: 'numberField',
            label: 'Number Field',
            type: 'number',
            required: false,
            default: 0
          }
        ]
      },
      values: {
        testField: '',
        numberField: 0
      },
      metadata: {
        tool_id: 'test_tool'
      }
    }
  };

  const mockProps = {
    response: mockResponse,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    messageIndex: 0,
    onChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Lock Mechanism', () => {
    it('should render form fields when not locked', () => {
      render(<StructuredToolResponse {...mockProps} />);
      
      const textField = screen.getByPlaceholderText('Enter value');
      expect(textField).toBeEnabled();
    });

    it('should disable all fields when locked', () => {
      const lockedResponse = { ...mockResponse, locked: true };
      render(<StructuredToolResponse {...mockProps} response={lockedResponse} />);
      
      const textField = screen.getByPlaceholderText('Enter value');
      expect(textField).toBeDisabled();
    });

    it('should show "Submitted" badge when locked', () => {
      const lockedResponse = { ...mockResponse, locked: true };
      render(<StructuredToolResponse {...mockProps} response={lockedResponse} />);
      
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('should show Edit button when locked', () => {
      const lockedResponse = { ...mockResponse, locked: true };
      render(<StructuredToolResponse {...mockProps} response={lockedResponse} />);
      
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should not show Edit button when not locked', () => {
      render(<StructuredToolResponse {...mockProps} />);
      
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });
  });

  describe('Submit Button', () => {
    it('should be enabled when not locked', () => {
      render(<StructuredToolResponse {...mockProps} />);
      
      const submitButton = screen.getByText('Submit');
      expect(submitButton).toBeEnabled();
    });

    it('should be disabled when locked', () => {
      const lockedResponse = { ...mockResponse, locked: true };
      render(<StructuredToolResponse {...mockProps} response={lockedResponse} />);
      
      const submitButton = screen.getByText('Submit');
      expect(submitButton).toBeDisabled();
    });

    it('should submit form with locked: true', async () => {
      const onEdit = vi.fn();
      render(<StructuredToolResponse {...mockProps} onEdit={onEdit} />);
      
      const textField = screen.getByPlaceholderText('Enter value');
      fireEvent.change(textField, { target: { value: 'test value' } });
      
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            locked: true,
            data: expect.objectContaining({
              values: expect.objectContaining({
                testField: 'test value'
              })
            })
          })
        );
      });
    });
  });

  describe('Edit Button', () => {
    it('should unlock form when Edit is clicked', () => {
      const onEdit = vi.fn();
      const lockedResponse = { ...mockResponse, locked: true };
      render(<StructuredToolResponse {...mockProps} response={lockedResponse} onEdit={onEdit} />);
      
      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);
      
      expect(onEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          locked: false
        })
      );
    });

    it('should re-validate form when unlocking', async () => {
      const onEdit = vi.fn();
      const lockedResponse = { 
        ...mockResponse, 
        locked: true,
        data: {
          ...mockResponse.data,
          values: {
            testField: '', // Invalid - required field empty
            numberField: 0
          }
        }
      };
      
      render(<StructuredToolResponse {...mockProps} response={lockedResponse} onEdit={onEdit} />);
      
      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);
      
      await waitFor(() => {
        expect(onEdit).toHaveBeenCalled();
      });
    });
  });

  describe('Field Changes', () => {
    it('should not allow field changes when locked', () => {
      const lockedResponse = { ...mockResponse, locked: true };
      render(<StructuredToolResponse {...mockProps} response={lockedResponse} />);
      
      const textField = screen.getByPlaceholderText('Enter value');
      fireEvent.change(textField, { target: { value: 'test value' } });
      
      expect(mockProps.onChange).not.toHaveBeenCalled();
    });

    it('should allow field changes when not locked', () => {
      render(<StructuredToolResponse {...mockProps} />);
      
      const textField = screen.getByPlaceholderText('Enter value');
      fireEvent.change(textField, { target: { value: 'test value' } });
      
      expect(mockProps.onChange).toHaveBeenCalledWith('testField', 'test value');
    });
  });
});