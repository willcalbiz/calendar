import { FunctionComponent, h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import CellBar from '@src/components/daygrid/cellBar';
import { useActions } from '@src/components/hooks/store';
import { useTheme } from '@src/components/hooks/theme';
import { Size } from '@src/controller/panel';
import ScheduleViewModel from '@src/model/scheduleViewModel';
import { PopupType } from '@src/modules/layerPopup';
import TZDate from '@src/time/date';
import { Day } from '@src/time/datetime';
import { cls } from '@src/util/cssHelper';
import { getPosition, getSize } from '@src/util/dom';
import { getMousePosition } from '@src/util/domEvent';
import { EVENT_HEIGHT, getExceedCount } from '@src/util/gridHelper';
import { ratio } from '@src/util/math';
import { convertPxToNum, toPercent } from '@src/util/units';

import {
  CSSValue,
  SeeMoreOptions,
  SeeMorePopupTheme,
  SeeMoreRectParam,
} from '@t/components/daygrid/cell';
import { PopupRect } from '@t/store';

const OUT_PADDING = 5;
const VIEW_MIN_WIDTH = 280;

interface Props {
  date: TZDate;
  dayIndex: Day;
  style?: {
    width?: CSSValue;
    left?: CSSValue;
    backgroundColor?: string;
    height?: CSSValue;
    top?: CSSValue;
  };
  parentContainer?: HTMLDivElement;
  appContainer?: HTMLDivElement;
  events?: ScheduleViewModel[];
  eventHeight?: number;
  height: number;
}

function getSeeMorePopupSize(
  styles: SeeMorePopupTheme,
  options: SeeMoreOptions,
  cell: HTMLDivElement,
  grid: HTMLDivElement,
  events: ScheduleViewModel[]
): Size {
  const minHeight = getSize(grid).height + OUT_PADDING * 2;
  let width: number = cell.offsetWidth + OUT_PADDING * 2;

  const { moreLayerSize, scheduleGutter, scheduleHeight } = options;
  const { width: layerWidth, height: layerHeight } = moreLayerSize;

  const maxVisibleSchedulesInLayer = 10;
  const { titleHeight, titleMarginBottom, paddingBottom } = styles;

  width = Math.max(width, VIEW_MIN_WIDTH);
  let height = convertPxToNum(titleHeight) + convertPxToNum(titleMarginBottom);

  if (events.length <= maxVisibleSchedulesInLayer) {
    height += (scheduleGutter + scheduleHeight) * events.length;
  } else {
    height += (scheduleGutter + scheduleHeight) * maxVisibleSchedulesInLayer;
  }
  height += convertPxToNum(paddingBottom);
  height += OUT_PADDING;

  if (layerWidth) {
    width = layerWidth;
  }

  if (layerHeight) {
    height = layerHeight;
  }

  if (isNaN(height) || height < minHeight) {
    height = minHeight;
  }

  return { width, height };
}

function getSeeMorePopupPosition(
  position: [positionX: number, positionY: number],
  popupSize: Size,
  appContainerSize: Size
) {
  const { width: containerWidth, height: containerHeight } = appContainerSize;
  const [leftPos, topPos] = position;
  const { width, height } = popupSize;

  const calWidth = (leftPos * containerWidth) / 100;
  const calHeight = (topPos * containerHeight) / 100;
  const isOverWidth = calWidth + width >= containerWidth;
  const isOverHeight = calHeight + height >= containerHeight;

  const left = toPercent(leftPos);
  const top = toPercent(topPos);

  if (isOverWidth && isOverHeight) {
    return {
      right: 0,
      bottom: 0,
    };
  }

  if (!isOverWidth && isOverHeight) {
    return {
      left,
      bottom: 0,
    };
  }

  if (isOverWidth && !isOverHeight) {
    return {
      right: 0,
      top,
    };
  }

  return { left, top };
}

function getDateColor(dayIndex: Day, commonTheme: CommonTheme) {
  const { holiday, saturday, today } = commonTheme;

  if (dayIndex === Day.SUN) {
    return holiday.color;
  }

  if (dayIndex === Day.SAT) {
    return saturday.color;
  }

  return today.color;
}

function getSeeMorePopupRect({
  cell,
  grid,
  theme,
  options,
  appContainer,
  events = [],
}: SeeMoreRectParam): PopupRect {
  const popupSize = getSeeMorePopupSize(theme, options, cell, grid, events);
  const appContainerSize = getSize(appContainer);

  const pos = getMousePosition(
    {
      clientX: getPosition(cell).x,
      clientY: getPosition(grid).y,
    } as MouseEvent,
    appContainer
  );

  let left = pos[0] - OUT_PADDING;
  let top = pos[1] - OUT_PADDING;

  left = ratio(appContainerSize.width, 100, left);
  top = ratio(appContainerSize.height, 100, top);

  const popupPosition = getSeeMorePopupPosition([left, top], popupSize, appContainerSize);

  return { ...popupSize, ...popupPosition };
}

function usePopupRect(
  monthTheme: MonthTheme,
  events: ScheduleViewModel[],
  parentContainer?: HTMLDivElement,
  appContainer?: HTMLDivElement
) {
  const container = useRef<HTMLDivElement>(null);
  const [popupRect, setPopupRect] = useState<PopupRect | null>(null);
  const { moreViewTitle, moreView, schedule: scheduleTheme } = monthTheme;

  useEffect(() => {
    const { marginBottom, height } = moreViewTitle;
    const { paddingBottom } = moreView;

    const theme: SeeMorePopupTheme = {
      titleHeight: height,
      titleMarginBottom: marginBottom,
      paddingBottom,
    };

    const options: SeeMoreOptions = {
      moreLayerSize: { width: null, height: null },
      scheduleGutter: convertPxToNum(scheduleTheme.height),
      scheduleHeight: convertPxToNum(scheduleTheme.marginTop),
    };

    if (appContainer && parentContainer) {
      const rect = getSeeMorePopupRect({
        cell: container.current,
        grid: parentContainer,
        theme,
        options,
        events,
        appContainer,
      });

      setPopupRect(rect);
    }
  }, [parentContainer, appContainer, moreViewTitle, moreView, scheduleTheme, events]);

  return { popupRect, container };
}

export const Cell: FunctionComponent<Props> = (props) => {
  const { show } = useActions('layerPopup');
  const theme = useTheme();

  const {
    common: commonTheme,
    month: {
      daygrid: {
        cell: { paddingBottom, paddingTop },
      },
    },
  } = theme;
  const {
    date,
    dayIndex,
    events = [],
    eventHeight = EVENT_HEIGHT,
    style,
    parentContainer,
    appContainer,
    height,
  } = props;

  const { popupRect, container } = usePopupRect(theme.month, events, parentContainer, appContainer);

  const onOpenSeeMorePopup = useCallback(() => {
    if (popupRect) {
      show({
        type: PopupType.seeMore,
        param: {
          date,
          popupRect,
          events,
        },
      });
    }
  }, [date, events, popupRect, show]);

  const exceedCount = getExceedCount(events, height, eventHeight);

  const cellStyle = {
    ...style,
    color: getDateColor(dayIndex, commonTheme),
    paddingBottom,
    paddingTop,
  };

  return (
    <div className={cls('daygrid-cell')} style={cellStyle} ref={container}>
      <CellBar exceedCount={exceedCount} date={date} onClickExceedCount={onOpenSeeMorePopup} />
    </div>
  );
};