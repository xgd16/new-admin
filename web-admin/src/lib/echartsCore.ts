import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { AxisPointerComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GridComponent, TooltipComponent, AxisPointerComponent, LineChart, CanvasRenderer])

export { echarts }
