import { FunctionComponent, h } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import CellHeader from '@src/components/dayGridMonth/cellHeader';
import {
  MONTH_EVENT_HEIGHT,
  MONTH_EVENT_MARGIN_TOP,
  MONTH_MORE_VIEW_HEADER_HEIGHT,
  MONTH_MORE_VIEW_HEADER_MARGIN_BOTTOM,
  MONTH_MORE_VIEW_MIN_WIDTH,
  MONTH_MORE_VIEW_PADDING,
} from '@src/constants/style';
import { useDispatch } from '@src/contexts/calendarStore';
import { useTheme } from '@src/contexts/theme';
import { cls, toPercent } from '@src/helpers/css';
import { getExceedCount } from '@src/helpers/grid';
import EventUIModel from '@src/model/eventUIModel';
import { PopupType } from '@src/slices/popup';
import TZDate from '@src/time/date';
import { Day } from '@src/time/datetime';
import { getPosition, getRelativePosition, getSize } from '@src/utils/dom';
import { ratio } from '@src/utils/math';

import { PopupPosition } from '@t/store';

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
  parentContainer?: HTMLDivElement | null;
  appContainer?: HTMLDivElement | null;
  events?: EventUIModel[];
  height: number;
}

interface RectSize {
  width: number;
  height: number;
}

function getSeeMorePopupSize(
  grid: HTMLDivElement,
  offsetWidth: number,
  eventLength: number,
  options: SeeMoreOptions
): RectSize {
  const minHeight = getSize(grid).height + MONTH_MORE_VIEW_PADDING * 2;
  let width = offsetWidth + MONTH_MORE_VIEW_PADDING * 2;

  const { moreLayerSize, eventHeight, eventMarginTop } = options;
  const { width: moreViewWidth, height: moreViewHeight } = moreLayerSize;

  const maxDisplayEventCount = 10;

  width = Math.max(width, MONTH_MORE_VIEW_MIN_WIDTH);
  let height =
    MONTH_MORE_VIEW_HEADER_HEIGHT + MONTH_MORE_VIEW_HEADER_MARGIN_BOTTOM + MONTH_MORE_VIEW_PADDING;

  if (eventLength <= maxDisplayEventCount) {
    height += (eventHeight + eventMarginTop) * eventLength;
  } else {
    height += (eventHeight + eventMarginTop) * maxDisplayEventCount;
  }

  if (moreViewWidth) {
    width = moreViewWidth;
  }

  if (moreViewHeight) {
    height = moreViewHeight;
  }

  if (isNaN(height) || height < minHeight) {
    height = minHeight;
  }

  return { width, height };
}

function getSeeMorePopupPosition(
  position: [positionX: number, positionY: number],
  popupSize: RectSize,
  appContainerSize: RectSize
) {
  const { width: containerWidth, height: containerHeight } = appContainerSize;
  const [leftPos, topPos] = position;
  const { width, height } = popupSize;

  const calendarWidth = (leftPos * containerWidth) / 100;
  const calendarHeight = (topPos * containerHeight) / 100;
  const isOverWidth = calendarWidth + width >= containerWidth;
  const isOverHeight = calendarHeight + height >= containerHeight;

  const left = toPercent(leftPos);
  const top = toPercent(topPos);

  if (isOverWidth) {
    return isOverHeight ? { right: 0, bottom: 0 } : { right: 0, top };
  }

  return isOverHeight ? { left, bottom: 0 } : { left, top };
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
  appContainer,
  grid,
  cell,
  popupSize,
}: SeeMoreRectParam): PopupPosition {
  const appContainerSize = getSize(appContainer);

  const pos = getRelativePosition(
    {
      clientX: getPosition(cell).x,
      clientY: getPosition(grid).y,
    } as MouseEvent,
    appContainer
  );

  let left = pos[0] - MONTH_MORE_VIEW_PADDING;
  let top = pos[1] - MONTH_MORE_VIEW_PADDING;

  left = ratio(appContainerSize.width, 100, left);
  top = ratio(appContainerSize.height, 100, top);

  const popupPosition = getSeeMorePopupPosition([left, top], popupSize, appContainerSize);

  return { ...popupSize, ...popupPosition };
}

function usePopupPosition(
  eventLength: number,
  parentContainer?: HTMLDivElement | null,
  appContainer?: HTMLDivElement | null
) {
  const container = useRef<HTMLDivElement>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);

  useEffect(() => {
    if (appContainer && parentContainer && container.current) {
      const popupSize = getSeeMorePopupSize(
        parentContainer,
        container.current.offsetWidth,
        eventLength,
        {
          moreLayerSize: { width: null, height: null },
          eventHeight: MONTH_EVENT_HEIGHT,
          eventMarginTop: MONTH_EVENT_MARGIN_TOP,
        }
      );

      const rect = getSeeMorePopupRect({
        cell: container.current,
        grid: parentContainer,
        appContainer,
        popupSize,
      });

      setPopupPosition(rect);
    }
  }, [appContainer, eventLength, parentContainer]);

  return { popupPosition, container };
}

export const GridCell: FunctionComponent<Props> = ({
  date,
  dayIndex,
  events = [],
  style,
  parentContainer,
  appContainer,
  height,
}) => {
  const { show } = useDispatch('popup');
  const theme = useTheme();

  const { common: commonTheme } = theme;

  const { popupPosition, container } = usePopupPosition(
    events.length,
    parentContainer,
    appContainer
  );

  const onOpenSeeMorePopup = useCallback(() => {
    if (popupPosition) {
      show({
        type: PopupType.seeMore,
        param: {
          date,
          popupPosition,
          events,
        },
      });
    }
  }, [date, events, popupPosition, show]);

  const exceedCount = getExceedCount(events, height, MONTH_EVENT_HEIGHT);

  return (
    <div
      className={cls('daygrid-cell')}
      style={{
        ...style,
        color: getDateColor(dayIndex, commonTheme),
      }}
      ref={container}
    >
      <CellHeader exceedCount={exceedCount} date={date} onClickExceedCount={onOpenSeeMorePopup} />
    </div>
  );
};