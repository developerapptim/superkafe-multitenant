/**
 * Unit Tests for ThemeSelector Component
 * 
 * Tests component rendering, theme selection, loading state, and visual preview functionality.
 * 
 * Feature: Seamless Branding Integration
 * Task: 6.3 Write unit tests for ThemeSelector
 * Requirements: 2.1, 2.2
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeSelector from '../../src/components/admin/ThemeSelector';
import { themePresets } from '../../src/config/themeStyles';

describe('ThemeSelector Component Unit Tests', () => {
  let mockOnThemeChange;

  beforeEach(() => {
    mockOnThemeChange = jest.fn();
    const root = document.documentElement;
    root.style.removeProperty('--bg-main');
    root.style.removeProperty('--bg-sidebar');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--text-primary');
    jest.clearAllMocks();
  });

  describe('Component renders all theme options', () => {
    test('renders all available theme presets', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      expect(screen.getByText('Default (Dark Purple)')).toBeInTheDocument();
      expect(screen.getByText('Light Coffee')).toBeInTheDocument();
    });

    test('renders theme descriptions', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      expect(screen.getByText('Tema gelap dengan aksen ungu yang elegan')).toBeInTheDocument();
      expect(screen.getByText('Tema terang dengan nuansa cokelat hangat')).toBeInTheDocument();
    });

    test('renders visual preview for each theme', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const bgMainLabels = screen.getAllByText('Background Utama');
      const bgSidebarLabels = screen.getAllByText('Background Sidebar');
      const accentLabels = screen.getAllByText('Warna Aksen');
      const textLabels = screen.getAllByText('Warna Teks');

      expect(bgMainLabels).toHaveLength(2);
      expect(bgSidebarLabels).toHaveLength(2);
      expect(accentLabels).toHaveLength(2);
      expect(textLabels).toHaveLength(2);
    });

    test('renders color hex values for each theme', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      expect(screen.getByText('#0F0A1F')).toBeInTheDocument();
      expect(screen.getByText('#1E1B4B')).toBeInTheDocument();
      expect(screen.getByText('#8B5CF6')).toBeInTheDocument();
      expect(screen.getByText('#FFFFFF')).toBeInTheDocument();
      expect(screen.getByText('#4E342E')).toBeInTheDocument();
      expect(screen.getByText('#A0522D')).toBeInTheDocument();
      expect(screen.getByText('#2D2D2D')).toBeInTheDocument();
    });

    test('marks current theme as selected', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      expect(screen.getByText(' Tema Aktif')).toBeInTheDocument();
    });

    test('shows selected badge only for current theme', () => {
      render(
        <ThemeSelector 
          currentTheme="light-coffee" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const activeBadges = screen.getAllByText(' Tema Aktif');
      expect(activeBadges).toHaveLength(1);
    });
  });

  describe('Theme selection triggers onThemeChange callback', () => {
    test('calls onThemeChange when theme card is clicked', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer');
      fireEvent.click(lightCoffeeCard);

      expect(mockOnThemeChange).toHaveBeenCalledWith('light-coffee');
      expect(mockOnThemeChange).toHaveBeenCalledTimes(1);
    });

    test('calls onThemeChange with correct theme name', () => {
      render(
        <ThemeSelector 
          currentTheme="light-coffee" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const defaultCard = screen.getByText('Default (Dark Purple)').closest('.cursor-pointer');
      fireEvent.click(defaultCard);

      expect(mockOnThemeChange).toHaveBeenCalledWith('default');
    });

    test('handles multiple theme selections', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer');
      fireEvent.click(lightCoffeeCard);

      const defaultCard = screen.getByText('Default (Dark Purple)').closest('.cursor-pointer');
      fireEvent.click(defaultCard);

      expect(mockOnThemeChange).toHaveBeenCalledTimes(2);
      expect(mockOnThemeChange).toHaveBeenNthCalledWith(1, 'light-coffee');
      expect(mockOnThemeChange).toHaveBeenNthCalledWith(2, 'default');
    });

    test('does not call onThemeChange when callback is not provided', () => {
      render(
        <ThemeSelector 
          currentTheme="default"
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer');
      
      expect(() => {
        fireEvent.click(lightCoffeeCard);
      }).not.toThrow();
    });
  });

  describe('Loading state disables interaction', () => {
    test('displays loading indicator when disabled', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
          disabled={true}
        />
      );

      expect(screen.getByText('Menyimpan tema...')).toBeInTheDocument();
    });

    test('applies opacity styling when disabled', () => {
      const { container } = render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
          disabled={true}
        />
      );

      const themeCards = container.querySelectorAll('.opacity-50');
      expect(themeCards.length).toBeGreaterThan(0);
    });

    test('applies cursor-not-allowed styling when disabled', () => {
      const { container } = render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
          disabled={true}
        />
      );

      const disabledCards = container.querySelectorAll('.cursor-not-allowed');
      expect(disabledCards.length).toBeGreaterThan(0);
    });

    test('does not call onThemeChange when disabled', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
          disabled={true}
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer, .cursor-not-allowed');
      fireEvent.click(lightCoffeeCard);

      expect(mockOnThemeChange).not.toHaveBeenCalled();
    });

    test('does not show loading indicator when not disabled', () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
          disabled={false}
        />
      );

      expect(screen.queryByText('Menyimpan tema...')).not.toBeInTheDocument();
    });

    test('shows loading spinner animation when disabled', () => {
      const { container } = render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
          disabled={true}
        />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Visual preview displays correctly', () => {
    test('displays color swatches for each theme property', () => {
      const { container } = render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const colorSwatches = container.querySelectorAll('.w-12.h-12.rounded-lg');
      expect(colorSwatches.length).toBeGreaterThanOrEqual(8);
    });

    test('applies correct background colors to preview swatches', () => {
      const { container } = render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const allElements = container.querySelectorAll('[style*="background"]');
      const bgColors = Array.from(allElements).map(el => 
        el.style.backgroundColor
      ).filter(Boolean);

      expect(bgColors.length).toBeGreaterThan(0);
    });

    test('displays text preview with correct styling', () => {
      const { container } = render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const textPreviews = screen.getAllByText('Aa');
      expect(textPreviews.length).toBe(2);
    });

    test('applies hover preview when mouse enters theme card', async () => {
      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer');
      
      fireEvent.mouseEnter(lightCoffeeCard);

      await waitFor(() => {
        const root = document.documentElement;
        const bgMain = root.style.getPropertyValue('--bg-main');
        expect(bgMain).toBe('#FFFFFF');
      });
    });

    test('reverts preview when mouse leaves theme card', async () => {
      const root = document.documentElement;
      root.style.setProperty('--bg-main', themePresets.default.bgMain);
      root.style.setProperty('--bg-sidebar', themePresets.default.bgSidebar);
      root.style.setProperty('--accent-color', themePresets.default.accentColor);
      root.style.setProperty('--text-primary', themePresets.default.textPrimary);

      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer');
      
      fireEvent.mouseEnter(lightCoffeeCard);
      fireEvent.mouseLeave(lightCoffeeCard);

      await waitFor(() => {
        const bgMain = root.style.getPropertyValue('--bg-main');
        expect(bgMain).toBe(themePresets.default.bgMain);
      });
    });

    test('does not apply preview when hovering over current theme', () => {
      const root = document.documentElement;
      root.style.setProperty('--bg-main', themePresets.default.bgMain);

      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      const defaultCard = screen.getByText('Default (Dark Purple)').closest('.cursor-pointer');
      
      fireEvent.mouseEnter(defaultCard);

      const bgMain = root.style.getPropertyValue('--bg-main');
      expect(bgMain).toBe(themePresets.default.bgMain);
    });

    test('does not apply preview when disabled', () => {
      const root = document.documentElement;
      root.style.setProperty('--bg-main', themePresets.default.bgMain);

      render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
          disabled={true}
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer, .cursor-not-allowed');
      
      fireEvent.mouseEnter(lightCoffeeCard);

      const bgMain = root.style.getPropertyValue('--bg-main');
      expect(bgMain).toBe(themePresets.default.bgMain);
    });
  });

  describe('Accessibility and edge cases', () => {
    test('renders without crashing when no props provided', () => {
      expect(() => {
        render(<ThemeSelector />);
      }).not.toThrow();
    });

    test('handles undefined currentTheme gracefully', () => {
      render(
        <ThemeSelector 
          currentTheme={undefined}
          onThemeChange={mockOnThemeChange}
        />
      );

      expect(screen.getByText('Default (Dark Purple)')).toBeInTheDocument();
      expect(screen.getByText('Light Coffee')).toBeInTheDocument();
    });

    test('handles null onThemeChange gracefully', () => {
      render(
        <ThemeSelector 
          currentTheme="default"
          onThemeChange={null}
        />
      );

      const lightCoffeeCard = screen.getByText('Light Coffee').closest('.cursor-pointer');
      
      expect(() => {
        fireEvent.click(lightCoffeeCard);
      }).not.toThrow();
    });

    test('maintains component structure with different currentTheme values', () => {
      const { rerender } = render(
        <ThemeSelector 
          currentTheme="default" 
          onThemeChange={mockOnThemeChange}
        />
      );

      expect(screen.getByText(' Tema Aktif')).toBeInTheDocument();

      rerender(
        <ThemeSelector 
          currentTheme="light-coffee" 
          onThemeChange={mockOnThemeChange}
        />
      );

      expect(screen.getByText(' Tema Aktif')).toBeInTheDocument();
    });
  });
});
