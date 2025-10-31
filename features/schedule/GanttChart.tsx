import React from 'react';
import { JAPANESE_PUBLIC_HOLIDAYS } from '../../constants';
import { formatDate } from '../../utils';

interface GanttChartHeaderProps {
    timelineDates: Date[];
    viewMode: 'daily' | 'weekly' | 'monthly';
    dayWidth: number;
}

const GanttChartHeader: React.FC<GanttChartHeaderProps> = ({ timelineDates, viewMode, dayWidth }) => {
    
    if (timelineDates.length === 0) {
        return <div className="h-[64px] border-b-2 border-slate-200 bg-slate-100"></div>;
    }

    if (viewMode === 'daily') {
        const months: { name: string; startIndex: number; }[] = [];
        let lastMonth = -1;
        timelineDates.forEach((date, index) => {
            const month = date.getMonth();
            if (month !== lastMonth) {
                months.push({ name: `${date.getFullYear()}年 ${month + 1}月`, startIndex: index });
                lastMonth = month;
            }
        });

        return (
            <div className="bg-slate-100 text-xs font-medium text-slate-600">
                <div className="flex border-b border-slate-200 h-[32px]">
                    {months.map((month, i) => {
                        const nextMonth = months[i + 1];
                        const daySpan = (nextMonth ? nextMonth.startIndex : timelineDates.length) - month.startIndex;
                        const width = daySpan * dayWidth;
                        const isLastMonth = i === months.length - 1;
                        const borderClass = isLastMonth ? 'border-r-slate-200' : 'border-r-slate-400';

                        return (
                            <div key={month.name} style={{ width: `${width}px` }} className={`flex items-center justify-center font-semibold border-r ${borderClass}`}>
                                {month.name}
                            </div>
                        );
                    })}
                </div>
                <div className="flex h-[32px]">
                    {timelineDates.map((date, index) => {
                        const day = date.getDay();
                        const isHoliday = JAPANESE_PUBLIC_HOLIDAYS.some(h => h.date === formatDate(date, 'yyyy-MM-dd'));
                        const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][day];
                        let textColor = 'text-slate-600';
                        let bgColor = 'bg-slate-100';
                        if (isHoliday || day === 0) {
                            textColor = 'text-red-500';
                            bgColor = 'bg-rose-50';
                        } else if (day === 6) {
                            textColor = 'text-blue-500';
                            bgColor = 'bg-sky-50';
                        }
                        
                        const isMonthEnd = index < timelineDates.length - 1 && date.getMonth() !== timelineDates[index + 1].getMonth();
                        const borderClass = isMonthEnd ? 'border-r-slate-400' : 'border-r-slate-200';


                        return (
                            <div key={index} style={{ minWidth: `${dayWidth}px` }} className={`flex flex-col items-center justify-center border-r ${borderClass} w-full ${bgColor}`}>
                                <span className={`text-xs ${textColor}`}>{dayLabel}</span>
                                <span className={`font-bold ${textColor}`}>{date.getDate()}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    } else if (viewMode === 'weekly') {
        const monthGroupHeaders: { name: string; weekSpan: number }[] = [];
        const weekLabels: string[] = [];
        const monthEndIndices = new Set<number>();
    
        if (timelineDates.length > 0) {
            const groupedByYear: { [year: string]: { [month: string]: Date[] } } = {};
            for (const date of timelineDates) {
                const year = date.getFullYear().toString();
                const month = (date.getMonth() + 1).toString();
                if (!groupedByYear[year]) groupedByYear[year] = {};
                if (!groupedByYear[year][month]) groupedByYear[year][month] = [];
                groupedByYear[year][month].push(date);
            }
    
            const sortedYears = Object.keys(groupedByYear).sort((a, b) => parseInt(a) - parseInt(b));
            let weekCounter = 0;
    
            for (const year of sortedYears) {
                const monthsInYear = groupedByYear[year];
                const sortedMonths = Object.keys(monthsInYear).sort((a, b) => parseInt(a) - parseInt(b));
                
                for (const month of sortedMonths) {
                    const weeks = monthsInYear[month];
                    monthGroupHeaders.push({ name: `${year}年/${month}月`, weekSpan: weeks.length });
                    
                    weeks.forEach((_week, index) => {
                        weekLabels.push(`${index + 1}週目`);
                    });

                    weekCounter += weeks.length;
                    monthEndIndices.add(weekCounter - 1);
                }
            }
        }

         return (
            <div className="bg-slate-100 text-xs font-medium text-slate-600 h-[64px] flex flex-col">
                <div className="flex border-b border-slate-200 h-[32px]">
                    {monthGroupHeaders.map((header, i) => (
                         <div key={i} style={{ width: `${header.weekSpan * dayWidth}px` }} className="flex items-center justify-center font-semibold border-r border-slate-400">
                            {header.name}
                        </div>
                    ))}
                </div>
                <div className="flex h-[32px]">
                    {timelineDates.map((_date, index) => {
                        const isMonthEnd = monthEndIndices.has(index);
                        const borderClass = isMonthEnd ? 'border-r-slate-400' : 'border-r-slate-200';
                        return (
                            <div key={index} style={{ minWidth: `${dayWidth}px` }} className={`flex items-center justify-center border-r ${borderClass} w-full`}>
                                <span className={`font-bold text-slate-600`}>{weekLabels[index]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    } else { // monthly
         return (
            <div className="bg-slate-100 flex text-xs font-medium text-slate-600 h-[64px]">
                {timelineDates.map((date, index) => {
                    const isYearEnd = index < timelineDates.length - 1 && date.getFullYear() !== timelineDates[index + 1].getFullYear();
                    const borderClass = isYearEnd ? 'border-r-slate-400' : 'border-r-slate-200';

                    return (
                        <div key={index} style={{ minWidth: `${dayWidth}px`, width: `${dayWidth}px`}} className={`flex items-center justify-center border-r ${borderClass} font-semibold`}>
                           {`${date.getFullYear()}年 ${date.getMonth() + 1}月`}
                        </div>
                    );
                })}
            </div>
        );
    }
};

export default GanttChartHeader;