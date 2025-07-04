# New Relic Synthetic Stack Custom Visualization

Please find the new home for this repository here: [https://github.com/newrelic-experimental/nr1-synthetic-stack](https://github.com/newrelic-experimental/nr1-synthetic-stack)

🚧 **WORK IN PROGRESS!** This visualization is still being built 🚧

This visualization provides a historical view of multiple synthetic journeys at once. It is driven by relatively simple NRQL configuration to make it easy to understand and reason about synthetic monitor status across a broad range of monitors at once.

![Screenshot](./screenshot1.png)

## Installation pre-requisites
Before you start make sure you have the following installed:

1. [Node.js](https://nodejs.org/) (>=12.13.0).

Also, make sure you are logged in to your New Relic account. (alternatively check out the [Set up your development environment guide](https://developer.newrelic.com/build-apps/set-up-dev-env/)).

### Installation

Clone the repository and run `npm install` to install dependencies.

You will need a development profile, you can read more about how to set up on the New Relic [developer site](https://developer.newrelic.com/)

To summarise the steps required:

- Navigate to the "Build your own Nerdpack" tile under `+Add data > Apps and visualizations`
- Follow steps one to three to download and install the NR1 CLI, generate API key and add the key to your profile (`nr1 profiles:add --name {account-slug} --api-key {api-key} --region {us|eu} `)
- Ensure the correct profile is selected: `nr1 profiles:default`
- Generate a new UUID for you instance of the visualization: `nr1 nerdpack:uuid -gf`

### Local Testing
You may test the application locally without deploying at this stage by running `nr1 nerdpack:serve`

### Deploy to account
To deploy visualization to your account so it can be used on dashboards follow these steps:

- Ensure the correct profile is selected: `nr1 profiles:default`
- Publish the assets: `nr1 nerdpack:publish` (this must be done on every update)
- Subscribe your account: `nr1 subscription:set` (this only needs to be done the first time)

The custom visualization should now appear as an option in the Custom Visualizations app (in the Apps > Custom Visualizations). Select the custom visualization, configure it and save to a dashboard.

Pro tip: Once a custom visualization is on a dashboard, you can click the ellipses to duplicate it.

## Configuration

The visualization is configured through the configuration panel. Much of the configuration is done using two NRQL queries that allow you to dynamically adjust thresholds and values based on the data.

### Planning your visualization configuration
Before configuring the visualization you should plan what 'states' you wish to display. You can display as many states as you wish. The simplest would be two states representing the synthetic check `result` values SUCCESS and FAILED. However you can go further adding more states based on the data. 

In this example configuration we have three states "Success", "Slow", and "Failed". Success and Slow represent checks with a `result` of `SUCCESS`, with Slow being those with an `executionDuration` above 5000ms. Failed is simply all checks with a `result` of `FAILED`.

For each state we need to define the following fields in the configuration panel:

- **Label:** A friendly name for the state ("Success", "Slow", "Failed")
- **Field:** The name of the field in the NRQL that returns the count of this state ("success", "slow", "failed")
- **Color:** A CSS colour value ("green","purple","red")
- **Is Problem:** Check this box if you consider this state a "problem state"


### Configuring the visualization

Once you have configured your states you can complete the rest of the configuration. The NRQL query is at the heart of the visualization and is decribed in more detail below. These are the fileds that can be configured:

- **Account ID:** The account from which to gather synthtic data from
- **Candidate monitor query:** The NRQL query to determine which monitors to show (described below)
- **Query:** The NRQL query to gather data (described below)
- **Bucket Size:** The size of each bucket in minutes (for the default 1 day view)
- **Statuses:** A set of statuses (see details above)
- **Fetch Interval:** Number of minutes between each data reload. 0 for none.
- **Collapse groups:** If checked then the individual monitors will be hidden by default (only the combined aggregates will show)
- **Show problems only:** If checked then only problem states will be rendered by default (can toggle using the status togge)
- **Ignore time picker:** If checked, dashboard time picker changes will be ignored

### Candidate monitor query
This NRQL query should simply return a list of entityGuids of the monitors you wish to display. This drives the data loading mechanism. Ensure you return a field called `entityGuids`, for example:

```
SELECT uniques(entityGuid,100) as entityGuids from SyntheticCheck where monitorName like '%Production%' 
```

### Monitor query
The second NRQL query provides the data to hydrate the visualisation. Some fields are mandatory, some are optional. This query is dispatched for each monitor provided by the first query.

In this example query we return three states: success, slow and failed. It also defines the average duration to exclude failed syntehtics (Failed synthetics may fail quickly or time out so it can be a good idea to exclude them from aggregate duration calculations).

```
WITH 
 if(typeLabel like '%Browser',12000,5000) as consideredSlow, 
 if(result='SUCCESS' and executionDuration < consideredSlow,'success',if(result='SUCCESS' and executionDuration >= consideredSlow,'slow','failed')) as monitorStatus 
FROM SyntheticCheck SELECT  
 latest(entityGuid) as entityGuid, 
 latest(monitorName) as monitorName, 
 latest(monitorName) as sortField, 
 latest(typeLabel) as groupName,
 latest(executionDuration) as latestDuration, 
 latest(monitorStatus) as latestStatus, 
 filter(count(*), where monitorStatus='success') as success, 
 filter(count(*), where monitorStatus='slow') as slow, 
 filter(count(*), where monitorStatus='failed') as failed,
 filter(average(executionDuration),where monitorStatus='success') as successDuration, 
 filter(average(executionDuration),where monitorStatus='slow') as slowDuration, 
 filter(average(executionDuration),where result='SUCCESS') as totalAvgDuration 
FACET entityGuid 
```

In this example query we first define in the WITH clasue what we consider "slow" is. In this case we use logic to choose a high value for Browser checks and a lower value for everything else. You could use any logic here, including tags available on the monitor which are a good way to provide individual monitor based thresholds. 

We also define in the WITH clasue the status for each check, using the `result` field and the `executionDuration`. This makes the rest of the query simpler to write.

The rest of the query provides the data to hydrate the visualization, each field is as follows:

- **entityGuid:** (Mandatory) This field is the monitor entity's GUID
- **monitorName:** (Mandatory) This surfaces the name of the monitor as it appears on the visualization.
- **sortField:** (optional) This allows you to control the sort order of monitors, in this example its simply set to the monitor name but you could use concat() with multiple fields to get creative and hoist specific monitors to the top of the list.
- **groupName:** (Mandatory) This field indicates the group the monitor should aggregated within. In this example we use the monitor type, but you can be creative group by anything appropriate for your business.
- **latestDuration:** (Mandatory) This provides the duration of the most recent check.
- **latestStatus:** (Mandatory) This provides the most recent check's state. Important: Its *value* should match the 'field' values in the Status configuration.
- **Status count fields:** (Mandatory) You need to provide fields that return the count of checks for each status. The names of these fields must relate to the statuses you have defined. In this example that is 'success', 'slow' and 'failed'.
- **Status duration fields:** (Optional) You can provide average duration fields for each of your states. The name of the field should be the field name suffixed "Duration". In this example we return "successDuration" and "slowDuration", we have chosen not to provide a duration for failed results, but you can if you like.
- **totalAvgDuration:** (Mandatory) This value is used to detemine the duration bar chart above each status bucket. In this example we decide to only include successful checks in this calculation.

> Note: The query may include anywhere the special string `[[ENTITY-GUID]]` that will be replaced with the entityGuid of the monitor. This allow you to use the entity guid in sub queries, such as calculating the 'consideredSlow' value from a historical average or percentile.

