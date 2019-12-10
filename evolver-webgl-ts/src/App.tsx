import * as React from "react";
import { Route, BrowserRouter, Switch, NavLink, Redirect } from "react-router-dom";
import { PaintingEvolverPage } from "./pages/paintingEvolver/PaintingEvolverPage";
import { MultiEvolverPage } from "./pages/multiEvolver/MultiEvolverPage";
import { VideoJobs } from "./pages/video-jobs/VideoJobs";

// Maybe someday use multi-page support
// import { Route, BrowserRouter } from "react-router-dom";
// import { createBrowserHistory } from "history";

/**
 * This is the wrapper application element. If this application
 * ever needs to support multiple pages, that
 * multi-page support would be configured here.
 * Currently only the calculator page is rendered.
 */
export class App extends React.Component {

    render() {
        return <BrowserRouter>
            <Switch>
                {/* TODO: change this later */}
            <Route path="/" exact={true} render={() => <Redirect to="/painting-evolver" />}/>
            <Route path="/painting-evolver" exact={true} component={PaintingEvolverPage} />
            <Route path="/video-jobs" exact={true} component={VideoJobs} />
            {/* <Route path="/multi" exact={true} component={MultiEvolverPage} /> */}
            </Switch>
            
        </BrowserRouter>;
    }
}
