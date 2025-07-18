
import { useProps } from "../context/VizPropsProvider";
import { useMonitorContext } from "../context/MonitorContextProvider";
import { Tooltip, navigation, Popover, PopoverTrigger, PopoverBody, Card, CardBody, BlockText, PopoverFooter, HeadingText, NrqlQuery, Spinner, Table, TableHeader, TableHeaderCell,TableRow,TableRowCell   } from 'nr1'
import moment, { min } from 'moment';


type AttributesListProps = {
  data: any,
  width: number
  combined?: boolean,
  monitorIds?: string[]
};

const Stripe = ({ data, width, combined, monitorIds }: AttributesListProps) => {

  const monitorContext = useMonitorContext();
  const {  numberOfBuckets, statusFilterList } = monitorContext;
  
  const vizProps = useProps();
  const { statuses, accountId, durationInMilliseconds } = vizProps;

  const bucketWidth = Math.floor((width - 120 - numberOfBuckets) / numberOfBuckets);

 const displayDuration = (duration)=>{
  return durationInMilliseconds===true ? duration.toFixed(0) + 'ms' : (duration / 1000).toFixed(2) + 's' ;
 }

  //work out the maximum duration across all the data blocks
  let maxTotalDurationAllBlocks=0;
  let minTotalDurationAllBlocks=null;
  let latestStatus=""
  let latestDuration=0;

  data.forEach((checkData,index) => {

      if(checkData?.data?.totalAvgDuration ) {
        if(checkData?.data?.totalAvgDuration > maxTotalDurationAllBlocks) {
          maxTotalDurationAllBlocks = checkData.data.totalAvgDuration;
        }
        if(minTotalDurationAllBlocks === null || checkData?.data?.totalAvgDuration < minTotalDurationAllBlocks) {
          minTotalDurationAllBlocks = checkData.data.totalAvgDuration;
        }
      }
      if(combined!== true && checkData?.data?.latestStatus && checkData?.data?.latestStatus!== "") {
        latestStatus= checkData?.data?.latestStatus;
        latestDuration = checkData?.data?.latestDuration;
      }

  });
  if(minTotalDurationAllBlocks === null) { minTotalDurationAllBlocks = 0;}

  let stripe = data.map((checkData, index) => {

    let blockChart = [];
    let blockSummary = statuses.map((status) => {
      return {statusField: status.statusField, statusLabel: status.statusLabel, statusColor: status.statusColor, count:0, percent:0 };
    });
    
    if(checkData.data) {

      const blockDuration=checkData?.data?.totalAvgDuration || 0;
      const blockPercentDuration = ((blockDuration-minTotalDurationAllBlocks) / (maxTotalDurationAllBlocks-minTotalDurationAllBlocks)) * 100;


      let totalChecks=0;
      let totalChecksAfterFilter=0;
 
      //determine how many checks there are in this block in total
      if(statuses && statuses.length > 0) {
        statuses.forEach((status) => {
          if(checkData?.data[status.statusField]) {
            totalChecks += checkData.data[status.statusField];
            if(!statusFilterList.includes(status.statusField)) {
              totalChecksAfterFilter += checkData.data[status.statusField];
            }
          }
        });
      }


    
      //render the chart accordingly
      blockChart = statuses.map((status) => {
        if(checkData?.data[status.statusField]) {
          const percentage = (checkData.data[status.statusField] / totalChecksAfterFilter) * 100;
          let summaryItem = blockSummary.find(item => item.statusField === status.statusField);
          if (summaryItem) {
            summaryItem.count = checkData.data[status.statusField];
            summaryItem.percent = percentage;
            summaryItem.execDuration=checkData.data[status.statusField+'Duration'];
          }
          if(!statusFilterList.includes(status.statusField)) {
            return <div style={{width: bucketWidth+'px', height: `${percentage}%`, backgroundColor:status.statusColor}} className="stripeBlockInner"></div>;
          } else {
            return null; //dont render this as its filtered
          }
          
        }
      });
    // }

   // let totalChecks = 0;
    let summaryItems = blockSummary.map((item, idx) => {
      //totalChecks+=item.count;
      return <div key={idx} className="keyContainer">
        <div className="keyBlock" style={{backgroundColor: item.statusColor}}></div>
        <div className="keyBlockDescription">{item.statusLabel}: {item.count} ({item.percent.toFixed(2)}%) {item.execDuration!==undefined ? `${displayDuration(item.execDuration.toFixed(0))}`: ''}</div>
      </div>;
    });







  const queryFilter = monitorIds && Array.isArray(monitorIds)
  ? `where entityGuid in (${monitorIds.map(id => `'${id}'`).join(', ')}) `
  : `where entityGuid = '${checkData.data.entityGuid}'`;

return <Tooltip text={`${checkData.beginMoment.format('MMMM Do YYYY, h:mm:ss')} - ${checkData.endMoment.format('h:mm:ss')},  ${totalChecks} checks, ${displayDuration(blockDuration)}`}>

  <Popover >
  <PopoverTrigger >
    <div className="stripeBlockContainer" style={{width: bucketWidth+'px'}} key={index}>
      <div  className="stripeDurationBlockOuter" >
        <div className="stripeDurationBlockInner" style={{ height: (blockPercentDuration)+'%' }}></div>
      </div>
      <div style={{width: '100%'}} className="stripeBlock" >
          {blockChart}
      </div>
    </div>
  </PopoverTrigger>
  <PopoverBody>
    <Card style={{ width: '500px' }}>
      <CardBody>
        <HeadingText>{checkData.beginMoment.format('MMMM Do YYYY, h:mm:ss')} - {checkData.endMoment.format('h:mm:ss')}</HeadingText>
        <BlockText>
          {summaryItems}
        </BlockText>
                <NrqlQuery
            accountIds={[accountId]}
            query={`SELECT toDateTime(timestamp,'hh:mm:ss') as timestamp, locationLabel, result, entityGuid, executionDuration, id as checkId, monitorName  from SyntheticCheck since ${checkData.beginMoment.valueOf()} until ${checkData.endMoment.valueOf()}  ${queryFilter} limit max`}
            pollInterval={0} 
            formatType={NrqlQuery.FORMAT_TYPE.RAW}
          >
            {({ data }) => {
              if (data) {
                const tableRows=data.results[0].events.map((item, idx) => {
                  return <tr>
                      <td>{item.timestamp}</td>
                      <td>{item.result}</td>
                      <td>{displayDuration(item.executionDuration)}</td>
                      { combined && (<td>{item.monitorName}</td>) }
                      { !combined && (<td>{item.locationLabel}</td>) }
                      <td><div onClick={()=>{
                        navigation.openStackedNerdlet({
                            id: 'synthetics.monitor-result-details',
                            urlState: {
                              entityGuid: item.entityGuid,
                              checkId: item.checkId
                            }
                          });
                      }}><span className="hyperlink">More Info</span></div></td>
                    </tr>
                });

                return <><hr className="checkRuleDivider" />
                  <div className="scrollableCheckTableContainer">
                  <table className="checkTable">
                    <tr>
                      <th>Time</th>
                      <th>Result</th>
                      <th>Duration</th>
                      { combined && (<th>Monitor</th>) }
                      { !combined && (<th>Location</th>) }
                      
                      <th>Detail</th>
                    </tr>
                  {tableRows}
                  </table>
                  </div>
                </>;
                
      
              } else {
                return <div><Spinner inline /> Loading...</div>;
              }
            }}
</NrqlQuery>
      </CardBody> 
    </Card>
    <PopoverFooter style={{ textAlign: 'right' }}>{totalChecks} total checks</PopoverFooter>
  </PopoverBody>
</Popover>
  </Tooltip>

} else {
  return <div className="stripeBlockContainer" style={{width: bucketWidth+'px'}} key={index}>
       <div  className="stripeDurationBlockOuter" ></div>
      <div  className="stripeBlock" >
      </div>
    </div>
}
  });

 let latestStatusDef = statuses.find((item)=>{  
  return item.statusField==latestStatus
});

  let latestBlock;
  if(combined=== true) {
    latestBlock =<div className="latestBlock">
          <div className="latestCheckLabel">Reporting:</div>
          <div>
            {monitorIds?.length} monitors
          </div>
        </div>
  } else {
    latestBlock =<div className="latestBlock">
      <div className="latestCheckLabel">Latest check:</div>
      <div className="latestStatusKey" style={{backgroundColor:  latestStatusDef?.statusColor || 'grey'}}></div>
      <div className="latestStatusText">
        <span  className="latestStatus">{latestStatusDef?.statusLabel || latestStatus}</span>
          <br />
        <span className="latestDuration" >{displayDuration(latestDuration)}</span>
      </div>
    </div>
  }

  
  return (
   <div className="stripeRow">
   {stripe}
   {latestBlock}
   </div>
  );

};

export default Stripe;